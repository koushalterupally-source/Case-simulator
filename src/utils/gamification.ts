import { CaseSession } from '../types';

/**
 * Gamification layer.
 *
 * Everything here is DERIVED from the existing CaseSession — no new persisted
 * fields, so saved sessions from older builds keep working with no migration.
 */

export type RankId = 'intern' | 'resident' | 'registrar' | 'consultant' | 'professor';

export interface Rank {
  id: RankId;
  label: string;
  minXp: number;
  /** Tailwind text colour for the rank chip. */
  tone: string;
}

export const RANKS: Rank[] = [
  { id: 'intern', label: 'Intern', minXp: 0, tone: 'text-slate-300' },
  { id: 'resident', label: 'Resident', minXp: 200, tone: 'text-cyan-300' },
  { id: 'registrar', label: 'Registrar', minXp: 500, tone: 'text-indigo-300' },
  { id: 'consultant', label: 'Consultant', minXp: 900, tone: 'text-amber-300' },
  { id: 'professor', label: 'Professor', minXp: 1400, tone: 'text-emerald-300' },
];

export const XP_CORRECT_GATE = 100;
export const XP_STREAK_STEP = 25;
export const XP_INCIDENTAL = 150;

export type BadgeId =
  | 'first_blood'
  | 'on_a_roll'
  | 'sharp_eye'
  | 'eagle_eye'
  | 'flawless'
  | 'comeback'
  | 'decisive';

export interface Badge {
  id: BadgeId;
  label: string;
  description: string;
  earned: boolean;
}

export interface GameStats {
  xp: number;
  streak: number;
  bestStreak: number;
  gatesTotal: number;
  gatesAnswered: number;
  gatesCorrect: number;
  accuracy: number;
  incidentalsCaught: number;
  incidentalsTotal: number;
  ordersPlaced: number;
  rank: Rank;
  nextRank: Rank | null;
  /** 0–100 progress toward the next rank; 100 when already at the top. */
  progressToNext: number;
  badges: Badge[];
}

export function rankForXp(xp: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) current = r;
  return current;
}

/**
 * XP for a gate, given how many correct answers immediately preceded it.
 * Consecutive correct answers are worth progressively more.
 */
export function xpForGate(streakBefore: number): number {
  return XP_CORRECT_GATE + streakBefore * XP_STREAK_STEP;
}

/**
 * XP actually earned at a specific gate, accounting for the streak the player
 * had built up when they answered it. Returns 0 for wrong or unanswered gates.
 */
export function xpAwardedForGate(session: CaseSession, gateIndex: number): number {
  const gates = session.decisionGates || [];
  const target = gates[gateIndex];
  if (!target || target.userAnswer === undefined || !target.isCorrect) return 0;

  let streak = 0;
  for (let i = 0; i < gateIndex; i++) {
    const g = gates[i];
    if (g.userAnswer === undefined) continue;
    streak = g.isCorrect ? streak + 1 : 0;
  }
  return xpForGate(streak);
}

export function computeGameStats(session: CaseSession): GameStats {
  const gates = session.decisionGates || [];
  const answered = gates.filter((g) => g.userAnswer !== undefined);
  const correct = answered.filter((g) => g.isCorrect);

  let xp = 0;
  let streak = 0;
  let bestStreak = 0;
  let hadWrong = false;
  let comeback = false;

  // Walk gates in order so streak bonuses compound the way the player saw them.
  for (const gate of gates) {
    if (gate.userAnswer === undefined) continue;
    if (gate.isCorrect) {
      xp += xpForGate(streak);
      streak += 1;
      if (streak > bestStreak) bestStreak = streak;
      if (hadWrong) comeback = true;
    } else {
      hadWrong = true;
      streak = 0;
    }
  }

  const incidentals = session.incidentalFindings || [];
  const caught = incidentals.filter((i) => i.status === 'noticed_addressed');
  xp += caught.length * XP_INCIDENTAL;

  const rank = rankForXp(xp);
  const nextRank = RANKS.find((r) => r.minXp > xp) || null;
  const progressToNext = nextRank
    ? Math.min(100, Math.round(((xp - rank.minXp) / (nextRank.minXp - rank.minXp)) * 100))
    : 100;

  const allAnswered = gates.length > 0 && answered.length === gates.length;

  const badges: Badge[] = [
    {
      id: 'first_blood',
      label: 'First Blood',
      description: 'Got your first decision gate right.',
      earned: correct.length >= 1,
    },
    {
      id: 'on_a_roll',
      label: 'On a Roll',
      description: 'Three correct decisions back to back.',
      earned: bestStreak >= 3,
    },
    {
      id: 'sharp_eye',
      label: 'Sharp Eye',
      description: 'Picked up an incidental finding nobody pointed you at.',
      earned: caught.length >= 1,
    },
    {
      id: 'eagle_eye',
      label: 'Eagle Eye',
      description: 'Caught every incidental finding in the case.',
      earned: incidentals.length > 0 && caught.length === incidentals.length,
    },
    {
      id: 'decisive',
      label: 'Decisive',
      description: 'Committed to every gate in the case.',
      earned: allAnswered,
    },
    {
      id: 'flawless',
      label: 'Flawless',
      description: 'Every gate in the case answered correctly.',
      earned: allAnswered && correct.length === gates.length,
    },
    {
      id: 'comeback',
      label: 'Comeback',
      description: 'Recovered with a correct call after getting one wrong.',
      earned: comeback,
    },
  ];

  return {
    xp,
    streak,
    bestStreak,
    gatesTotal: gates.length,
    gatesAnswered: answered.length,
    gatesCorrect: correct.length,
    accuracy: answered.length ? Math.round((correct.length / answered.length) * 100) : 0,
    incidentalsCaught: caught.length,
    incidentalsTotal: incidentals.length,
    ordersPlaced: (session.completedOrders || []).length + (session.pendingOrders || []).length,
    rank,
    nextRank,
    progressToNext,
    badges,
  };
}

/** Severity of a single vital sign, used to drive colour and animation. */
export type VitalSeverity = 'normal' | 'warning' | 'critical';

export function hrSeverity(hr: number): VitalSeverity {
  if (!hr || hr <= 0) return 'normal';
  if (hr >= 130 || hr <= 45) return 'critical';
  if (hr > 110 || hr < 60) return 'warning';
  return 'normal';
}

export function spo2Severity(spo2: number): VitalSeverity {
  if (!spo2 || spo2 <= 0) return 'normal';
  if (spo2 < 90) return 'critical';
  if (spo2 < 94) return 'warning';
  return 'normal';
}

export function rrSeverity(rr: number): VitalSeverity {
  if (!rr || rr <= 0) return 'normal';
  if (rr >= 30 || rr <= 8) return 'critical';
  if (rr > 22 || rr < 12) return 'warning';
  return 'normal';
}

/** Reads the systolic value out of a "120/80" string. */
export function systolicOf(bp: string): number | null {
  const m = String(bp).match(/(\d+)\s*\/\s*\d+/);
  return m ? parseInt(m[1], 10) : null;
}

export function bpSeverity(bp: string): VitalSeverity {
  const sys = systolicOf(bp);
  if (sys === null) return 'normal';
  if (sys < 90 || sys >= 180) return 'critical';
  if (sys < 100 || sys >= 160) return 'warning';
  return 'normal';
}

/** Accepts "38.4°C", "101.2°F" or a bare number assumed to be Celsius. */
export function tempSeverity(temp: string | number): VitalSeverity {
  const raw = String(temp);
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 'normal';
  let c = parseFloat(m[1]);
  if (/f/i.test(raw) || c > 50) c = ((c - 32) * 5) / 9;
  if (c >= 39.5 || c < 35) return 'critical';
  if (c >= 38 || c < 36) return 'warning';
  return 'normal';
}

export function grbsSeverity(grbs: number | string): VitalSeverity {
  const m = String(grbs).match(/(\d+(?:\.\d+)?)/);
  if (!m) return 'normal';
  const v = parseFloat(m[1]);
  if (v <= 0) return 'normal';
  if (v < 55 || v >= 400) return 'critical';
  if (v < 70 || v >= 200) return 'warning';
  return 'normal';
}

/** How many vitals are currently deranged — drives the patient stability meter. */
export function instabilityScore(session: CaseSession): number {
  if (session.isQuestionLed) return 0;
  const v = session.patient?.currentVitals;
  if (!v) return 0;
  const sevs = [
    hrSeverity(v.hr),
    spo2Severity(v.spo2),
    rrSeverity(v.rr),
    bpSeverity(v.bp),
    tempSeverity(v.temp),
    grbsSeverity(v.grbs),
  ];
  return sevs.reduce((acc, s) => acc + (s === 'critical' ? 2 : s === 'warning' ? 1 : 0), 0);
}

export function stabilityLabel(score: number): { label: string; tone: string } {
  if (score >= 6) return { label: 'CRITICAL', tone: 'text-rose-400' };
  if (score >= 3) return { label: 'UNSTABLE', tone: 'text-amber-400' };
  if (score >= 1) return { label: 'GUARDED', tone: 'text-yellow-300' };
  return { label: 'STABLE', tone: 'text-emerald-400' };
}
