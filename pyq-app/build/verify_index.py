#!/usr/bin/env python3
"""
verify_index.py -- stdlib-only checker for the output of build_index.py.

Asserts:
  - every catalog shard reference resolves to files that exist
  - every .q.json has a matching .a.json of identical length and matching
    ids in the same order
  - no file exceeds 1 MB
  - every `correct` is a valid index into its options
  - counts in catalog.json match the actual shard contents
  - paper question counts match the catalog

Exits non-zero (and prints every failure found) on any violation.

Usage:
    python3 verify_index.py --dir <out-dir>
"""

import argparse
import json
import os
import sys

HARD_LIMIT_BYTES = 1_048_576


class Checker:
    def __init__(self):
        self.failures = []
        self.checks = 0

    def ok(self, cond, msg):
        self.checks += 1
        if not cond:
            self.failures.append(msg)

    def report(self):
        print(f"ran {self.checks} checks")
        if self.failures:
            print(f"FAILED: {len(self.failures)} problem(s) found:")
            for f in self.failures[:200]:
                print(f"  - {f}")
            if len(self.failures) > 200:
                print(f"  ... and {len(self.failures) - 200} more")
            return False
        print("PASSED: no problems found")
        return True


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_file_size(chk, path, label):
    sz = os.path.getsize(path)
    chk.ok(sz <= HARD_LIMIT_BYTES, f"{label}: {path} is {sz} bytes, exceeds {HARD_LIMIT_BYTES}-byte limit")
    return sz


def check_shard_pair(chk, shards_dir, shard_id, expected_count=None):
    """Validate one shard's .q.json/.a.json pair. Returns (count, q_list, a_list) or (0, [], [])."""
    q_path = os.path.join(shards_dir, f"{shard_id}.q.json")
    a_path = os.path.join(shards_dir, f"{shard_id}.a.json")

    q_exists = os.path.isfile(q_path)
    a_exists = os.path.isfile(a_path)
    chk.ok(q_exists, f"missing shard file: {q_path}")
    chk.ok(a_exists, f"missing shard file: {a_path}")
    if not (q_exists and a_exists):
        return 0, [], []

    check_file_size(chk, q_path, f"shard {shard_id}.q.json")
    check_file_size(chk, a_path, f"shard {shard_id}.a.json")

    q_list = load_json(q_path)
    a_list = load_json(a_path)

    chk.ok(isinstance(q_list, list), f"{shard_id}.q.json is not a JSON array")
    chk.ok(isinstance(a_list, list), f"{shard_id}.a.json is not a JSON array")

    chk.ok(len(q_list) == len(a_list),
           f"{shard_id}: q.json has {len(q_list)} items, a.json has {len(a_list)} items")

    n = min(len(q_list), len(a_list))
    for i in range(n):
        qid = q_list[i].get("id")
        aid = a_list[i].get("id")
        chk.ok(qid == aid, f"{shard_id}: id mismatch at index {i}: q={qid!r} a={aid!r}")

    for i in range(n):
        q_item = q_list[i]
        a_item = a_list[i]
        options = q_item.get("options")
        correct = a_item.get("correct")
        if not isinstance(options, list) or not isinstance(correct, int):
            chk.ok(False, f"{shard_id}: item {i} (id={q_item.get('id')}) has malformed options/correct")
            continue
        chk.ok(0 <= correct < len(options),
               f"{shard_id}: item {i} (id={q_item.get('id')}) has correct={correct} "
               f"out of range for {len(options)} options")

    if expected_count is not None:
        chk.ok(len(q_list) == expected_count,
               f"{shard_id}: catalog declares {expected_count} questions but shard has {len(q_list)}")

    return len(q_list), q_list, a_list


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", required=True, help="output directory to verify (as produced by build_index.py)")
    args = ap.parse_args()

    out_dir = os.path.abspath(args.dir)
    shards_dir = os.path.join(out_dir, "shards")
    chk = Checker()

    for fn in ("catalog.json", "report.json", "lexicon.json"):
        path = os.path.join(out_dir, fn)
        chk.ok(os.path.isfile(path), f"missing required file: {path}")
    if chk.failures:
        chk.report()
        return 1

    for fn in ("catalog.json", "report.json", "lexicon.json"):
        check_file_size(chk, os.path.join(out_dir, fn), fn)

    catalog = load_json(os.path.join(out_dir, "catalog.json"))
    totals = catalog.get("totals", {})

    # ---- practice ------------------------------------------------------
    practice_sum = 0
    for entry in catalog.get("practice", []):
        subject_sum = 0
        for group in entry.get("groups", []):
            shard_id = group.get("shard")
            chk.ok(bool(shard_id), f"practice group {entry.get('slug')}/{group.get('name')} has no 'shard'")
            if not shard_id:
                continue
            count, q_list, a_list = check_shard_pair(chk, shards_dir, shard_id, expected_count=group.get("count"))
            subject_sum += group.get("count", count)
        chk.ok(subject_sum == entry.get("total"),
               f"practice subject {entry.get('slug')}: groups sum to {subject_sum} "
               f"but total says {entry.get('total')}")
        practice_sum += entry.get("total", 0)

    chk.ok(practice_sum == totals.get("practice"),
           f"catalog totals.practice={totals.get('practice')} but practice entries sum to {practice_sum}")

    # ---- papers ----------------------------------------------------------
    papers_sum = 0
    seen_paper_ids = set()
    for paper in catalog.get("papers", []):
        pid = paper.get("id")
        chk.ok(pid not in seen_paper_ids, f"duplicate paper id: {pid}")
        seen_paper_ids.add(pid)

        shard_ids = paper.get("shards", [])
        chk.ok(isinstance(shard_ids, list) and len(shard_ids) > 0,
               f"paper {pid} has no shards listed")

        total_in_shards = 0
        for shard_id in shard_ids:
            count, q_list, a_list = check_shard_pair(chk, shards_dir, shard_id)
            total_in_shards += count
            # every question in a paper shard must carry a dupOf key (paper schema)
            for item in q_list:
                chk.ok("dupOf" in item, f"paper {pid} shard {shard_id}: item {item.get('id')} missing 'dupOf'")

        chk.ok(total_in_shards == paper.get("count"),
               f"paper {pid}: catalog count={paper.get('count')} but shards contain {total_in_shards}")

        count = paper.get("count", 0)
        expected_kind = "grand-test" if count >= 50 else "quiz"
        chk.ok(paper.get("kind") == expected_kind,
               f"paper {pid}: count={count} implies kind={expected_kind!r} but catalog says {paper.get('kind')!r}")

        chk.ok(bool(paper.get("date")), f"paper {pid} has no date")

        papers_sum += count

    chk.ok(papers_sum == totals.get("papers"),
           f"catalog totals.papers={totals.get('papers')} but paper entries sum to {papers_sum}")

    # ---- cross-check totals reconcile with source/dropped ----------------
    src = totals.get("source")
    prac = totals.get("practice")
    pap = totals.get("papers")
    drp = totals.get("dropped")
    if None not in (src, prac, pap, drp):
        chk.ok(src == prac + pap + drp,
               f"totals do not reconcile: source={src} practice={prac} papers={pap} dropped={drp}")

    # ---- no stray shard files not referenced by the catalog, and no file >1MB anywhere ----
    referenced_shard_ids = set()
    for entry in catalog.get("practice", []):
        for group in entry.get("groups", []):
            if group.get("shard"):
                referenced_shard_ids.add(group["shard"])
    for paper in catalog.get("papers", []):
        for sid in paper.get("shards", []):
            referenced_shard_ids.add(sid)

    if os.path.isdir(shards_dir):
        on_disk = set()
        for fn in os.listdir(shards_dir):
            check_file_size(chk, os.path.join(shards_dir, fn), fn)
            if fn.endswith(".q.json"):
                on_disk.add(fn[: -len(".q.json")])
            elif fn.endswith(".a.json"):
                on_disk.add(fn[: -len(".a.json")])
        orphans = on_disk - referenced_shard_ids
        chk.ok(len(orphans) == 0, f"{len(orphans)} shard id(s) on disk are not referenced by catalog.json: "
                                   f"{sorted(orphans)[:10]}")
        missing = referenced_shard_ids - on_disk
        chk.ok(len(missing) == 0, f"{len(missing)} shard id(s) referenced by catalog.json are missing on disk: "
                                   f"{sorted(missing)[:10]}")

    ok = chk.report()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
