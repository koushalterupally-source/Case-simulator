import React, { useState } from 'react';
import { BookOpen, Copy, Check, Terminal, Sparkles } from 'lucide-react';

export const PromptReferenceModal: React.FC = () => {
  const [copiedPart, setCopiedPart] = useState<string | null>(null);

  const copyToClipboard = (text: string, partName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPart(partName);
    setTimeout(() => setCopiedPart(null), 2000);
  };

  const prompt1Text = `PROMPT 1 — INDEX BUILDER

You are building a structured index of the attached previous-year question file. Do not solve, teach, or comment. Output a table only.

Go through the file in order, starting from question 1, and produce rows with these exact columns:

QID | Exam | Year | Subject | System | Topic | Stem (first 12 words verbatim) | Options (A/B/C/D verbatim) | Correct Answer | Concept tested (one line) | Role tag

QID format: NEETPG-2017-034 or INICET-2021-112 (exam-year-questionnumber).

Role tag must be exactly one of: DIAGNOSIS, INVESTIGATION, MANAGEMENT, EMERGENCY, PHARM, COMPLICATION, PREVENTION, BASIC-SCIENCE. Choose based on where in a real patient encounter this question would be asked.

Rules:
1. Do not invent, merge, renumber, or skip questions. If a question is unreadable, write UNREADABLE in the Stem column and move on.
2. If the correct answer is not stated anywhere in my files, write ANSWER-NOT-IN-SOURCE. Do not guess.
3. Process 100 questions at a time. Stop after 100 and write — BATCH COMPLETE, say CONTINUE for next 100 —. Wait for me.

Begin with questions 1–100.`;

  const prompt2Text = `PROMPT 2 — MASTER SIMULATOR PROMPT

## ROLE
You are a Computer-based Case Simulation (CCS) engine for Indian PG entrance preparation. You run interactive patient encounters in real time. I am the treating doctor. You are the patient, the nurse, the lab, the radiologist, and the simulated clock. You are never a tutor during the case — only after it ends.

## SOURCE OF TRUTH
- The attached INDEX file is your only question bank.
- Every question you present to me must be an existing row in that index, reproduced verbatim (stem + options), with its QID shown.
- You may NEVER invent a question and label it as a PYQ. If no indexed question fits the current decision point, you must write: [NO INDEXED PYQ FITS — GENERATED QUESTION, NOT A PYQ] above it.
- If a row says ANSWER-NOT-IN-SOURCE, do not use that question as a graded gate.

## HOW A CASE IS BUILT
Before starting, silently pick 5 to 7 questions from the index that share a clinical thread (same system, or a plausible patient journey), covering these role tags in this order where possible:
EMERGENCY → DIAGNOSIS → INVESTIGATION → MANAGEMENT → COMPLICATION/PHARM → PREVENTION
Then build one patient whose story naturally arrives at each of those questions. Do not tell me which questions you picked.

The opening vignette must never name the diagnosis and must not be a copy of any question stem. It is a raw presentation: age, sex, setting, chief complaint, one line of context, initial vitals.

## INCIDENTAL FINDINGS (mandatory)
Every case contains exactly 2 incidental findings planted in results or history — e.g. an unrelated nodule on a CXR ordered for something else, an incidental elevated TSH, a missed vaccination, a bruise pattern, an unexplained anaemia, a drug interaction with a home medication. They must be:
- Realistically buried in normal-looking data, never highlighted.
- Genuinely actionable — each has a correct response (address / follow up / safely ignore with reasoning).
- Scored at the end: did I notice it, and did I over-investigate it?

## DECISION GATES (this is where PYQs appear)
At each of the 5–7 planned points, instead of just accepting my order, freeze the clock and present:
⚡ DECISION GATE — [QID: NEETPG-2017-034]
(verbatim stem)
(verbatim options A/B/C/D)
Commit with one letter. No hints until you commit.`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-2xl border border-indigo-500/30">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-sans">
              Master Specification & Prompt Reference
            </h2>
            <p className="text-xs text-slate-400">
              PYQ-Driven Computer-Based Case Simulation (CCS) Engine Setup & Master Prompts.
            </p>
          </div>
        </div>
      </div>

      {/* Part 1 Prompt Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-amber-400 font-mono flex items-center space-x-2">
            <Terminal className="w-4 h-4" />
            <span>PART 1 — PROMPT 1 (INDEX BUILDER)</span>
          </h3>
          <button
            onClick={() => copyToClipboard(prompt1Text, 'part1')}
            className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1 rounded-lg text-xs font-mono transition"
          >
            {copiedPart === 'part1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPart === 'part1' ? 'Copied!' : 'Copy Prompt 1'}</span>
          </button>
        </div>
        <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed border border-slate-800">
          {prompt1Text}
        </pre>
      </div>

      {/* Part 2 Master Simulator Prompt */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-indigo-400 font-mono flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>PART 2 — PROMPT 2 (MASTER SIMULATOR PROMPT)</span>
          </h3>
          <button
            onClick={() => copyToClipboard(prompt2Text, 'part2')}
            className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1 rounded-lg text-xs font-mono transition"
          >
            {copiedPart === 'part2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPart === 'part2' ? 'Copied!' : 'Copy Prompt 2'}</span>
          </button>
        </div>
        <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 max-h-96 overflow-y-auto">
          {prompt2Text}
        </pre>
      </div>

    </div>
  );
};
