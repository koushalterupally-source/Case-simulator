export type RoleTag = 
  | 'EMERGENCY'
  | 'DIAGNOSIS'
  | 'INVESTIGATION'
  | 'MANAGEMENT'
  | 'PHARM'
  | 'COMPLICATION'
  | 'PREVENTION'
  | 'BASIC-SCIENCE';

export type ExamType = 'NEET-PG' | 'INI-CET' | 'CUSTOM';

export type SubjectType = 
  | 'Medicine' 
  | 'Surgery' 
  | 'OBGY' 
  | 'Pediatrics' 
  | 'Pharmacology' 
  | 'Pathology' 
  | 'PSM' 
  | 'Emergency'
  | 'ENT'
  | 'Ophthalmology'
  | 'Orthopedics';

export interface PYQItem {
  qid: string; // e.g. NEETPG-2017-034
  exam: ExamType;
  year: number | string;
  subject: SubjectType;
  system: string;
  topic: string;
  stem: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  conceptTested: string;
  roleTag: RoleTag;
  explanation?: string;
}

export type LocationType = 'Emergency' | 'OPD' | 'Ward' | 'ICU' | 'OT' | 'Home';

export interface Vitals {
  hr: number;
  bp: string;
  rr: number;
  spo2: number;
  temp: string;
  grbs: number | string;
}

export interface IncidentalFinding {
  id: string;
  title: string;
  description: string; // e.g. "CXR shows 8mm solitary nodule in RUL"
  correctAction: string;
  status: 'unnoticed' | 'noticed_addressed' | 'over_investigated' | 'ignored_safely';
  notes?: string;
}

export interface DecisionGate {
  id: string;
  pyq: PYQItem;
  triggerTurnIndex: number;
  patientContext: string;
  userAnswer?: 'A' | 'B' | 'C' | 'D' | string;
  isCorrect?: boolean;
  consequenceMessage?: string;
  explanationGiven?: string;
  timeSpentSeconds?: number;
}

export type OrderCategory = 'labs' | 'imaging' | 'drugs' | 'consults' | 'procedures' | 'monitoring';

export interface OrderResultItem {
  id: string;
  orderName: string;
  category: OrderCategory;
  placedSimTime: string;
  readySimTime: string;
  isReady: boolean;
  resultText: string;
  turnaroundMinutes: number;
}

export interface SimTurn {
  turnIndex: number;
  simTime: { day: number; hour: number; minute: number };
  location: LocationType;
  whatHappened: string;
  vitals: Vitals;
  newResults: OrderResultItem[];
  activeGate?: DecisionGate;
  userCommand?: string;
}

export type CaseMode = 'standard' | 'rapid' | 'mixed' | 'weakness' | 'blind';

export interface PatientState {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female';
  chiefComplaint: string;
  setting: string;
  initialVitals: Vitals;
  currentVitals: Vitals;
  diagnosis: string;
  clinchingClue: string;
  clinchingClueTime: string;
}

export interface EndOfCaseScorecard {
  finalDiagnosis: string;
  clinchingClue: string;
  clinchingTime: string;
  pyqScore: { correct: number; total: number; percentage: number };
  gateResults: {
    qid: string;
    examYear: string;
    topic: string;
    roleTag: RoleTag;
    userChoice?: string;
    correctChoice: string;
    isCorrect: boolean;
    concept: string;
    consequence: string;
  }[];
  incidentalFindingsReport: {
    title: string;
    outcome: string;
    status: 'noticed_addressed' | 'unnoticed' | 'over_investigated' | 'ignored_safely';
    scoreNote: string;
  }[];
  criticalDelays: string[];
  overOrderingList: string[];
  preventionChecklist: { item: string; status: 'done' | 'missed' }[];
  topConceptsToRevise: { concept: string; sourceQIDs: string[] }[];
  overallGrade: 'S' | 'A' | 'B' | 'C' | 'F';
  overallScore: number;
  summaryFeedback: string;
}

export interface CaseSession {
  id: string;
  title: string;
  mode: CaseMode;
  subject: string;
  patient: PatientState;
  currentLocation: LocationType;
  simTime: { day: number; hour: number; minute: number };
  turns: SimTurn[];
  pendingOrders: OrderResultItem[];
  completedOrders: OrderResultItem[];
  historyLog: { question: string; answer: string; time: string }[];
  examLog: { system: string; findings: string; time: string }[];
  decisionGates: DecisionGate[];
  currentGateIndex: number;
  incidentalFindings: IncidentalFinding[];
  status: 'active' | 'paused' | 'completed';
  scorecard?: EndOfCaseScorecard;
  blindMode?: boolean;
}
