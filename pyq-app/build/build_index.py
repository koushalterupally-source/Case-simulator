#!/usr/bin/env python3
"""
build_index.py -- build-time data pipeline for the offline PYQ question-bank app.

Reads the read-only medqbank asset tree (pyq/ + cereb/) and emits the catalog +
sharded question/answer files described in pyq-app/ARCHITECTURE.md.

Python 3, standard library only. No network access, no third-party imports.

Usage:
    python3 build_index.py --src <assets-dir> --out <out-dir>

<assets-dir> must contain pyq/ and cereb/ subdirectories (each with a
manifest.json and the bank JSON files), matching
$MEDQBANK/android/app/src/main/assets.
"""

import argparse
import html
import json
import math
import os
import random
import re
import shutil
import sys
from collections import defaultdict, OrderedDict

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

SCHEMA_VERSION = 1

# The 5 cereb files that are containers of whole mock papers, not subjects.
CONTAINER_FILENAMES = {
    "grand_tests.json",
    "grand_tests_2.json",
    "previous_year_tests.json",
    "best_of_the_rest.json",
    "best_of_the_rest_subject_wise.json",
}

# Human-facing "source" label + id-prefix for each container file.
CONTAINER_INFO = {
    "grand_tests_2.json": {"source": "Grand Tests", "prefix": "gt2"},
    # Only used if the containment check against grand_tests_2 fails.
    "grand_tests.json": {"source": "Grand Tests (Legacy)", "prefix": "gt1"},
    "previous_year_tests.json": {"source": "Previous Year Tests", "prefix": "pyt"},
    "best_of_the_rest.json": {"source": "Best of the Rest", "prefix": "btr"},
    "best_of_the_rest_subject_wise.json": {"source": "Best of the Rest (Subject-wise)", "prefix": "btrsw"},
}

# Explicit canonicalization map. Anything not listed passes through unchanged.
SUBJECT_CANON = {
    "Anesthesia": "Anaesthesia",
    "Anaesthesia": "Anaesthesia",
    "Orthopedics": "Orthopaedics",
    "Orthopaedics": "Orthopaedics",
}

MAX_SHARD_BYTES = 1_000_000     # split trigger: keep shards comfortably under 1 MB
HARD_LIMIT_BYTES = 1_048_576    # 1 MiB -- the actual hard limit we assert at the end

MIN_EXPLANATION_CHARS = 60

# --- subject-classification tuning -----------------------------------------
# Chosen via an internal 80/20 train/validation split over the subject-tagged
# practice corpus (see build_lexicon_and_validate()). At these settings the
# lexicon pass measured ~93% precision at ~21% reach on held-out question
# text -- precision is favoured over reach per the spec.
LEX_MIN_SUBJECT_DOCS = 5   # a term must appear in >= this many docs of a subject to be considered
LEX_SCORE_CUT = 3.0        # a term must clear this log-odds score to enter a subject's lexicon
CLASSIFY_FLOOR = 8.0       # absolute score floor to accept the top subject
CLASSIFY_MARGIN = 2.5      # top subject must beat the runner-up by at least this much
VALIDATION_SEED = 42
VALIDATION_SPLIT = 0.8

TAG_RE = re.compile(r"<[^>]+>")
NONWORD_RE = re.compile(r"[^\w]+", re.UNICODE)
IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
SRC_ATTR_RE = re.compile(r"src\s*=\s*[\"']([^\"']*)[\"']", re.IGNORECASE)
WORD_RE = re.compile(r"[a-z]{3,}")

STOPWORDS = frozenset("""
the and for with was are that this from into onto has have had not but who whom which
where when what why how are is was were will would could should shall can may might his her their its
our your you they them she him been being than then also more most less least each such only just
some any all both either neither each other same about above after before between during under over
following seen shows show given due associated commonly usually most likely most common typically
patient patients presents presenting history year old years male female case man woman boy girl
diagnosis likely next best true false regarding correct incorrect except cause causes
one two three four five investigation management treatment done used complains
comes came presented below among not her his the a an all
""".split())


# --------------------------------------------------------------------------
# Small utilities
# --------------------------------------------------------------------------

def strip_tags_text(s):
    """Strip HTML tags and unescape entities; return plain text."""
    if not s:
        return ""
    return html.unescape(TAG_RE.sub(" ", s)).strip()


def normalize_key(question_text):
    """lowercase, strip non-word characters, first 200 chars -- the dedup /
    exact-match key used throughout the spec."""
    t = question_text.lower()
    t = NONWORD_RE.sub("", t)
    return t[:200]


def tokenize(question_text):
    t = TAG_RE.sub(" ", question_text).lower()
    return [w for w in WORD_RE.findall(t) if w not in STOPWORDS]


def has_remote_image(text):
    for tag in IMG_TAG_RE.findall(text):
        m = SRC_ATTR_RE.search(tag)
        if m:
            src = m.group(1).strip().lower()
            if src.startswith("http://") or src.startswith("https://"):
                return True
    return False


def slugify(name):
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


DATE_SUFFIX_RE = re.compile(r"\s*-\s*(\d{4})-(\d{2})-(\d{2})\s*$")
DDMMYYYY_SUFFIX_RE = re.compile(r"\s*-\s*(\d{2})-(\d{2})-(\d{4})\s*$")


def parse_paper_name_date(subtopic):
    """Parse the trailing YYYY-MM-DD off a paper's subtopic, and strip it
    (plus any duplicated DD-MM-YYYY fragment) from the display name.
    Returns (name, date_str) or (None, None) if unparseable.
    """
    m = DATE_SUFFIX_RE.search(subtopic)
    if not m:
        return None, None
    date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    name = subtopic[:m.start()].rstrip()
    m2 = DDMMYYYY_SUFFIX_RE.search(name)
    if m2:
        d, mo, y = m2.group(1), m2.group(2), m2.group(3)
        if f"{y}-{mo}-{d}" == date_str:
            name = name[:m2.start()].rstrip()
    return name.strip(), date_str


def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_compact(path, obj):
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    with open(path, "w", encoding="utf-8") as f:
        f.write(data)
    return len(data.encode("utf-8"))


def json_item_bytes(item):
    return len(json.dumps(item, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


# --------------------------------------------------------------------------
# Source loading
# --------------------------------------------------------------------------

def list_bank_files(bank_dir):
    """Return sorted list of *.json files in a bank dir, excluding manifest.json."""
    names = [n for n in os.listdir(bank_dir) if n.endswith(".json") and n != "manifest.json"]
    names.sort()
    return names


def load_records(src_dir):
    """Load every record from pyq/ and cereb/, tagging each with its
    originating file and a stable synthetic ref for dedup bookkeeping.
    Returns (practice_records, container_records_by_file).
    """
    pyq_dir = os.path.join(src_dir, "pyq")
    cereb_dir = os.path.join(src_dir, "cereb")

    practice_records = []  # list of dicts, each augmented with _ref, _origSubject, _sourceLabel, _sourceFile
    container_by_file = OrderedDict()  # filename -> list of records

    ref_counter = [0]

    def next_ref():
        ref_counter[0] += 1
        return ref_counter[0]

    for fn in list_bank_files(pyq_dir):
        path = os.path.join(pyq_dir, fn)
        for rec in read_json(path):
            rec["_ref"] = next_ref()
            rec["_sourceLabel"] = "PYQ"
            rec["_sourceFile"] = f"pyq/{fn}"
            practice_records.append(rec)

    for fn in list_bank_files(cereb_dir):
        path = os.path.join(cereb_dir, fn)
        records = read_json(path)
        if fn in CONTAINER_FILENAMES:
            for rec in records:
                rec["_ref"] = next_ref()
                rec["_sourceFile"] = f"cereb/{fn}"
            container_by_file[fn] = records
        else:
            for rec in records:
                rec["_ref"] = next_ref()
                rec["_sourceLabel"] = "CEREB"
                rec["_sourceFile"] = f"cereb/{fn}"
                practice_records.append(rec)

    return practice_records, container_by_file


# --------------------------------------------------------------------------
# Step 1: grand_tests.json containment verification
# --------------------------------------------------------------------------

def verify_grand_tests_containment(container_by_file):
    """Verify grand_tests.json's unique questions are a subset of
    grand_tests_2.json's, by normalized-text key. Returns a report dict and
    whether grand_tests.json should be dropped.
    """
    if "grand_tests.json" not in container_by_file or "grand_tests_2.json" not in container_by_file:
        return {
            "checked": False,
            "reason": "one or both files not present in source tree",
        }, False

    gt1 = container_by_file["grand_tests.json"]
    gt2 = container_by_file["grand_tests_2.json"]

    gt1_keys = set(normalize_key(r["question"]) for r in gt1)
    gt2_keys = set(normalize_key(r["question"]) for r in gt2)
    missing = gt1_keys - gt2_keys

    contained = len(missing) == 0
    report = {
        "checked": True,
        "grandTestsUniqueQuestions": len(gt1_keys),
        "grandTests2UniqueQuestions": len(gt2_keys),
        "grandTestsRecords": len(gt1),
        "missingCount": len(missing),
        "contained": contained,
        "action": "dropped grand_tests.json entirely (redundant file)" if contained
                  else "KEPT grand_tests.json -- containment did not hold",
    }
    return report, contained


# --------------------------------------------------------------------------
# Step 2: practice-bank dedup (subject canonicalization applied here too)
# --------------------------------------------------------------------------

def dedup_practice(practice_records):
    """Canonicalize subject names, then deduplicate the practice corpus on the
    normalized question-text key, keeping the copy with the longest stripped
    explanation-detail text. Returns:
      - kept_refs: set of _ref values that survive
      - key_to_kept_record: dict normKey -> the surviving record (canonicalized)
      - canon_changes: dict of original subject -> canonical subject -> count
      - dup_removed: int
    """
    best_by_key = {}         # key -> record
    best_len_by_key = {}     # key -> stripped-explanation length
    canon_changes = defaultdict(int)

    for rec in practice_records:
        orig_subject = rec["subject"]
        canon_subject = SUBJECT_CANON.get(orig_subject, orig_subject)
        if canon_subject != orig_subject:
            canon_changes[f"{orig_subject} -> {canon_subject}"] += 1
        rec["_canonSubject"] = canon_subject

        key = normalize_key(rec["question"])
        rec["_normKey"] = key
        explen = len(strip_tags_text(rec["explanation"]["detail"]))

        if key not in best_by_key or explen > best_len_by_key[key]:
            best_by_key[key] = rec
            best_len_by_key[key] = explen

    kept_refs = set(rec["_ref"] for rec in best_by_key.values())
    dup_removed = len(practice_records) - len(kept_refs)

    return kept_refs, best_by_key, dict(canon_changes), dup_removed


# --------------------------------------------------------------------------
# Step 3: subject-classification lexicon (log-odds) + validation
# --------------------------------------------------------------------------

def build_term_stats(training_records):
    """training_records: list of dicts with '_canonSubject' and 'question'.
    Returns (subj_doc_count, term_subj_count, term_total_count, N)."""
    subj_doc_count = defaultdict(int)
    term_subj_count = defaultdict(lambda: defaultdict(int))
    term_total_count = defaultdict(int)
    n = 0
    for rec in training_records:
        subj = rec["_canonSubject"]
        subj_doc_count[subj] += 1
        n += 1
        for t in set(tokenize(rec["question"])):
            term_subj_count[t][subj] += 1
            term_total_count[t] += 1
    return subj_doc_count, term_subj_count, term_total_count, n


def build_lexicon(subj_doc_count, term_subj_count, term_total_count, n, min_a, score_cut):
    """Build subject -> {term: score} using log-odds with add-1 smoothing."""
    lexicon = defaultdict(dict)
    for t, subj_counts in term_subj_count.items():
        total_t = term_total_count[t]
        for subj, a in subj_counts.items():
            if a < min_a:
                continue
            big_a = subj_doc_count[subj]
            b = total_t - a
            big_b = n - big_a
            score = math.log((a + 1) / (big_a - a + 1)) - math.log((b + 1) / (big_b - b + 1))
            if score > score_cut:
                lexicon[subj][t] = score
    return {s: dict(terms) for s, terms in lexicon.items()}


def build_inverted_lexicon(lexicon):
    """term -> {subject: weight}, for fast per-token scoring."""
    inv = defaultdict(dict)
    for subj, terms in lexicon.items():
        for t, w in terms.items():
            inv[t][subj] = w
    return inv


def classify_by_lexicon(question_text, inverted_lexicon, floor, margin):
    scores = defaultdict(float)
    for t in set(tokenize(question_text)):
        weights = inverted_lexicon.get(t)
        if weights:
            for subj, w in weights.items():
                scores[subj] += w
    if not scores:
        return None
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top_subj, top_score = ranked[0]
    runner_score = ranked[1][1] if len(ranked) > 1 else 0.0
    if top_score >= floor and (top_score - runner_score) >= margin:
        return top_subj
    return None


def validate_lexicon_thresholds(practice_pool_records):
    """80/20 split over the deduped, canonicalized practice pool to estimate
    the precision/reach of the chosen (floor, margin) thresholds on unseen
    question text. Returns a stats dict for report.json.
    """
    records = list(practice_pool_records)
    rng = random.Random(VALIDATION_SEED)
    rng.shuffle(records)
    split = int(len(records) * VALIDATION_SPLIT)
    train, val = records[:split], records[split:]

    subj_doc_count, term_subj_count, term_total_count, n = build_term_stats(train)
    lexicon = build_lexicon(subj_doc_count, term_subj_count, term_total_count, n,
                             LEX_MIN_SUBJECT_DOCS, LEX_SCORE_CUT)
    inv = build_inverted_lexicon(lexicon)

    correct = wrong = 0
    for rec in val:
        pred = classify_by_lexicon(rec["question"], inv, CLASSIFY_FLOOR, CLASSIFY_MARGIN)
        if pred is None:
            continue
        if pred == rec["_canonSubject"]:
            correct += 1
        else:
            wrong += 1
    resolved = correct + wrong
    return {
        "method": "80/20 holdout over the deduped practice corpus, seed=%d" % VALIDATION_SEED,
        "trainSize": len(train),
        "valSize": len(val),
        "resolved": resolved,
        "correct": correct,
        "wrong": wrong,
        "precision": (correct / resolved) if resolved else None,
        "reach": (resolved / len(val)) if val else None,
        "params": {
            "lexMinSubjectDocs": LEX_MIN_SUBJECT_DOCS,
            "lexScoreCut": LEX_SCORE_CUT,
            "classifyFloor": CLASSIFY_FLOOR,
            "classifyMargin": CLASSIFY_MARGIN,
        },
    }


# --------------------------------------------------------------------------
# Sharding
# --------------------------------------------------------------------------

def write_shards(pairs, out_shards_dir, id_prefix):
    """pairs: ordered list of (q_item, a_item) dicts, already fully formed
    except for the 'n' field within the shard group (caller sets 'n' before
    calling this, since 'n' is a per-group, not per-shard, concept).

    Splits into sequential shards so neither the q-array nor the a-array
    exceeds MAX_SHARD_BYTES. Returns list of shard ids in order, plus the
    max file size written (for the final hard-limit assertion).
    """
    shard_ids = []
    max_bytes_seen = 0

    shard_idx = 0
    cur_pairs = []
    cur_q_bytes = 2   # "[" + "]"
    cur_a_bytes = 2

    def flush():
        nonlocal shard_idx, cur_pairs, cur_q_bytes, cur_a_bytes, max_bytes_seen
        if not cur_pairs:
            return
        shard_id = f"{id_prefix}-{shard_idx}"
        q_list = [p[0] for p in cur_pairs]
        a_list = [p[1] for p in cur_pairs]
        qn = write_json_compact(os.path.join(out_shards_dir, f"{shard_id}.q.json"), q_list)
        an = write_json_compact(os.path.join(out_shards_dir, f"{shard_id}.a.json"), a_list)
        max_bytes_seen = max(max_bytes_seen, qn, an)
        shard_ids.append(shard_id)
        shard_idx += 1
        cur_pairs = []
        cur_q_bytes = 2
        cur_a_bytes = 2

    for q_item, a_item in pairs:
        qb = json_item_bytes(q_item)
        ab = json_item_bytes(a_item)
        sep = 1 if cur_pairs else 0
        would_q = cur_q_bytes + qb + sep
        would_a = cur_a_bytes + ab + sep
        if cur_pairs and (would_q > MAX_SHARD_BYTES or would_a > MAX_SHARD_BYTES):
            flush()
            sep = 0
            would_q = cur_q_bytes + qb + sep
            would_a = cur_a_bytes + ab + sep
        cur_pairs.append((q_item, a_item))
        cur_q_bytes = would_q
        cur_a_bytes = would_a

    flush()
    return shard_ids, max_bytes_seen


# --------------------------------------------------------------------------
# Main build
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", required=True, help="path to the medqbank assets dir (contains pyq/ and cereb/)")
    ap.add_argument("--out", required=True, help="output directory (wiped and regenerated)")
    args = ap.parse_args()

    src_dir = os.path.abspath(args.src)
    out_dir = os.path.abspath(args.out)

    if not os.path.isdir(os.path.join(src_dir, "pyq")) or not os.path.isdir(os.path.join(src_dir, "cereb")):
        print(f"error: {src_dir} does not contain pyq/ and cereb/", file=sys.stderr)
        return 1

    # ---- wipe & recreate output dir --------------------------------------
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    shards_dir = os.path.join(out_dir, "shards")
    os.makedirs(shards_dir)

    report = {}

    # ---- load everything ---------------------------------------------------
    practice_records, container_by_file = load_records(src_dir)
    source_total = len(practice_records) + sum(len(v) for v in container_by_file.values())
    report["sourceTotalQuestions"] = source_total

    # ---- step: grand_tests.json containment --------------------------------
    gt_report, gt1_contained = verify_grand_tests_containment(container_by_file)
    report["grandTestsContainment"] = gt_report
    dropped_count = 0
    if gt1_contained:
        dropped_count += len(container_by_file.pop("grand_tests.json"))

    # ---- step: canonicalize + dedup practice banks -------------------------
    kept_refs, key_to_kept, canon_changes, dup_removed = dedup_practice(practice_records)
    report["subjectCanonicalization"] = canon_changes
    report["practiceDedup"] = {
        "recordsBeforeDedup": len(practice_records),
        "recordsAfterDedup": len(kept_refs),
        "duplicatesRemoved": dup_removed,
    }
    dropped_count += dup_removed

    surviving_practice = [r for r in practice_records if r["_ref"] in kept_refs]

    # ---- step: subject classification lexicon (train on full dedup pool) --
    validation_stats = validate_lexicon_thresholds(surviving_practice)
    report["classificationValidation"] = validation_stats

    subj_doc_count, term_subj_count, term_total_count, n_train = build_term_stats(surviving_practice)
    lexicon = build_lexicon(subj_doc_count, term_subj_count, term_total_count, n_train,
                             LEX_MIN_SUBJECT_DOCS, LEX_SCORE_CUT)
    inverted_lexicon = build_inverted_lexicon(lexicon)

    lexicon_path = os.path.join(out_dir, "lexicon.json")
    write_json_compact(lexicon_path, {
        "params": {
            "lexMinSubjectDocs": LEX_MIN_SUBJECT_DOCS,
            "lexScoreCut": LEX_SCORE_CUT,
            "classifyFloor": CLASSIFY_FLOOR,
            "classifyMargin": CLASSIFY_MARGIN,
        },
        "subjects": lexicon,
    })

    # ==========================================================================
    # PRACTICE catalog + shards
    # ==========================================================================
    # group surviving practice records by (sourceLabel, canonSubject), then by
    # subtopic (preserving original first-appearance order within each file).
    practice_groups = OrderedDict()  # (sourceLabel, subject) -> OrderedDict(subtopic -> [records])

    for rec in surviving_practice:
        top_key = (rec["_sourceLabel"], rec["_canonSubject"])
        practice_groups.setdefault(top_key, OrderedDict())
        practice_groups[top_key].setdefault(rec["subtopic"], [])
        practice_groups[top_key][rec["subtopic"]].append(rec)

    practice_catalog = []
    practice_total_questions = 0
    practice_needs_image = 0
    max_shard_bytes_seen = 0

    # stable, readable order: PYQ before CEREB, then subject name
    for (source_label, subject) in sorted(practice_groups.keys(), key=lambda k: (k[0] != "PYQ", k[1])):
        subtopics = practice_groups[(source_label, subject)]
        slug = f"{source_label.lower()}-{slugify(subject)}"
        groups_out = []
        subject_total = 0

        for subtopic_idx, (subtopic_name, recs) in enumerate(subtopics.items()):
            pairs = []
            for n, rec in enumerate(recs):
                needs_img = has_remote_image(rec["question"])
                if needs_img:
                    practice_needs_image += 1
                q_item = {
                    "id": rec["id"],
                    "n": n,
                    "question": rec["question"],
                    "options": rec["options"],
                    "subject": rec["_canonSubject"],
                    "subjectFrom": "given",
                    "needsImage": needs_img,
                }
                detail = rec["explanation"]["detail"]
                has_expl = len(strip_tags_text(detail)) >= MIN_EXPLANATION_CHARS
                a_item = {
                    "id": rec["id"],
                    "correct": rec["correct"],
                    "short": rec["explanation"]["short"],
                    "detail": detail,
                    "hasExplanation": has_expl,
                }
                pairs.append((q_item, a_item))

            group_id_prefix = f"{slug}-{subtopic_idx}"
            shard_ids, max_bytes = write_shards(pairs, shards_dir, group_id_prefix)
            max_shard_bytes_seen = max(max_shard_bytes_seen, max_bytes)
            assert len(shard_ids) == 1, (
                f"practice group {slug}/{subtopic_name} needed {len(shard_ids)} shards; "
                "the catalog schema assumes practice groups fit in one shard"
            )
            groups_out.append({
                "name": subtopic_name,
                "count": len(recs),
                "shard": shard_ids[0],
            })
            subject_total += len(recs)

        practice_catalog.append({
            "source": source_label,
            "subject": subject,
            "slug": slug,
            "total": subject_total,
            "groups": groups_out,
        })
        practice_total_questions += subject_total

    # ==========================================================================
    # PAPERS catalog + shards
    # ==========================================================================
    # Duplicate-tracking map, seeded with the practice pool's surviving keys so
    # that a paper question matching a practice-bank question is flagged too.
    dup_key_to_id = {rec["_normKey"]: rec["id"] for rec in key_to_kept.values()}

    papers_catalog = []
    papers_total_questions = 0
    papers_needs_image = 0
    date_parse_failures = []
    container_exact = 0
    container_lexicon = 0
    container_unclassified = 0
    container_total = 0
    by_file_paper_counts = {}

    for fn in sorted(container_by_file.keys()):
        info = CONTAINER_INFO[fn]
        records = container_by_file[fn]

        # group into papers by subtopic, preserving order of first appearance
        papers = OrderedDict()
        for rec in records:
            papers.setdefault(rec["subtopic"], []).append(rec)

        # order papers chronologically (ascending) within this file for id
        # assignment; parse dates now so we can sort and validate up front.
        parsed = []
        for subtopic, recs in papers.items():
            name, date_str = parse_paper_name_date(subtopic)
            if date_str is None:
                date_parse_failures.append({"file": fn, "subtopic": subtopic})
            parsed.append((subtopic, name, date_str, recs))

        parsed.sort(key=lambda p: (p[2] is None, p[2] or "", p[0]))

        by_file_paper_counts[fn] = len(parsed)

        for idx, (subtopic, name, date_str, recs) in enumerate(parsed):
            paper_id = f"{info['prefix']}-{idx:03d}"
            pairs = []
            for n, rec in enumerate(recs):
                container_total += 1
                key = rec["_normKey"] if "_normKey" in rec else normalize_key(rec["question"])
                rec["_normKey"] = key

                # subject classification: exact match against practice pool first
                subject = None
                subject_from = None
                if key in key_to_kept:
                    subject = key_to_kept[key]["_canonSubject"]
                    subject_from = "exact"
                    container_exact += 1
                else:
                    pred = classify_by_lexicon(rec["question"], inverted_lexicon, CLASSIFY_FLOOR, CLASSIFY_MARGIN)
                    if pred is not None:
                        subject = pred
                        subject_from = "lexicon"
                        container_lexicon += 1
                    else:
                        container_unclassified += 1

                # duplicate tracking (never removes anything from a paper)
                existing = dup_key_to_id.get(key)
                dup_of = None
                if existing is not None and existing != rec["id"]:
                    dup_of = existing
                else:
                    dup_key_to_id.setdefault(key, rec["id"])

                needs_img = has_remote_image(rec["question"])
                if needs_img:
                    papers_needs_image += 1

                q_item = {
                    "id": rec["id"],
                    "n": n,
                    "question": rec["question"],
                    "options": rec["options"],
                    "subject": subject,
                    "subjectFrom": subject_from,
                    "needsImage": needs_img,
                    "dupOf": dup_of,
                }
                detail = rec["explanation"]["detail"]
                has_expl = len(strip_tags_text(detail)) >= MIN_EXPLANATION_CHARS
                a_item = {
                    "id": rec["id"],
                    "correct": rec["correct"],
                    "short": rec["explanation"]["short"],
                    "detail": detail,
                    "hasExplanation": has_expl,
                }
                pairs.append((q_item, a_item))

            shard_ids, max_bytes = write_shards(pairs, shards_dir, paper_id)
            max_shard_bytes_seen = max(max_shard_bytes_seen, max_bytes)

            count = len(recs)
            papers_catalog.append({
                "id": paper_id,
                "name": name if name is not None else subtopic,
                "date": date_str,
                "source": info["source"],
                "count": count,
                "shards": shard_ids,
                "kind": "grand-test" if count >= 50 else "quiz",
            })
            papers_total_questions += count

    # sort the final papers list newest-first for browse-screen convenience
    papers_catalog.sort(key=lambda p: (p["date"] is None, p["date"] or ""), reverse=True)

    # ---- classification / date-parse assertions & report -------------------
    report["papers"] = {
        "totalPapers": len(papers_catalog),
        "byFile": by_file_paper_counts,
        "dateParseFailures": date_parse_failures,
    }
    if date_parse_failures:
        print(f"WARNING: {len(date_parse_failures)} paper subtopic(s) had no parseable date "
              f"(see report.json papers.dateParseFailures)", file=sys.stderr)
    else:
        assert len(papers_catalog) > 0

    report["subjectClassification"] = {
        "containerQuestions": container_total,
        "exact": {"count": container_exact, "pct": container_exact / container_total if container_total else None},
        "lexicon": {"count": container_lexicon, "pct": container_lexicon / container_total if container_total else None},
        "unclassified": {"count": container_unclassified, "pct": container_unclassified / container_total if container_total else None},
    }

    report["needsImage"] = {
        "practice": practice_needs_image,
        "papers": papers_needs_image,
        "total": practice_needs_image + papers_needs_image,
    }

    # ---- totals & sanity invariant ------------------------------------------
    totals = {
        "source": source_total,
        "practice": practice_total_questions,
        "papers": papers_total_questions,
        "dropped": dropped_count,
    }
    assert totals["source"] == totals["practice"] + totals["papers"] + totals["dropped"], (
        f"totals do not reconcile: {totals}"
    )
    report["totals"] = totals

    # ---- write catalog.json --------------------------------------------------
    catalog = {
        "builtAt": "2026-08-27T00:00:00Z",
        "totals": totals,
        "practice": practice_catalog,
        "papers": papers_catalog,
    }
    write_json_compact(os.path.join(out_dir, "catalog.json"), catalog)

    # ---- shard-size hard-limit assertion --------------------------------------
    largest = 0
    largest_file = None
    for fn in os.listdir(shards_dir):
        sz = os.path.getsize(os.path.join(shards_dir, fn))
        if sz > largest:
            largest = sz
            largest_file = fn
    report["sharding"] = {
        "shardCount": len(os.listdir(shards_dir)),
        "largestShardBytes": largest,
        "largestShardFile": largest_file,
        "hardLimitBytes": HARD_LIMIT_BYTES,
    }
    assert largest <= HARD_LIMIT_BYTES, (
        f"shard {largest_file} is {largest} bytes, exceeding the {HARD_LIMIT_BYTES}-byte hard limit"
    )

    # ---- write report.json (do this last so it captures sharding too) --------
    write_json_compact(os.path.join(out_dir, "report.json"), report)

    # ---- final size check on catalog/lexicon/report themselves ---------------
    for fn in ("catalog.json", "report.json", "lexicon.json"):
        sz = os.path.getsize(os.path.join(out_dir, fn))
        assert sz <= HARD_LIMIT_BYTES, f"{fn} is {sz} bytes, exceeding the {HARD_LIMIT_BYTES}-byte hard limit"

    print(f"OK: wrote {out_dir}")
    print(f"  source questions: {source_total}")
    print(f"  practice (post-dedup): {practice_total_questions}  papers: {papers_total_questions}  dropped: {dropped_count}")
    print(f"  grand_tests.json containment: {gt_report.get('contained')}")
    print(f"  classification: exact={container_exact} lexicon={container_lexicon} unclassified={container_unclassified} of {container_total}")
    print(f"  largest shard: {largest} bytes ({largest_file})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
