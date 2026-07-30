export type RoleTag = 
  | 'EMERGENCY'
  | 'DIAGNOSIS'
  | 'INVESTIGATION'
  | 'MANAGEMENT'
  | 'PHARM'
  | 'COMPLICATION'
  | 'PREVENTION'
  | 'BASIC-SCIENCE'
  | 'UNTAGGED';

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
  | 'Orthopedics'
  | 'Basic Science'
  | 'Previous Year Papers';

export interface PYQItem {
  qid: string; // e.g. NEETPG-2017-034
  displayId?: string; // human readable ID
  sourceFile?: string; // provenance filename
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
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'ANSWER-NOT-IN-SOURCE';
  conceptTested: string;
  roleTag: RoleTag;
  explanation?: string;
  isDraft?: boolean;
}

export type LocationType = 'Emergency' | 'OPD' | 'Ward' | 'ICU' | 'OT' | 'Home';

export interface Vitals {
  hr: number;
  bp: string;
  rr: number;
  spo2: number;
  temp: string;
  grbs: number; // numeric e.g. 110 mg/dL
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
  isSelfReview?: boolean;
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
  seed: string;
  scaffoldId: string;
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

export interface CaseScaffold {
  id: string;
  title: string;
  conditionName: string;
  subject: SubjectType;
  system: string;
  demographics: {
    name: string;
    age: number;
    gender: 'Male' | 'Female';
    setting: LocationType;
  };
  openingVignette: string; // Vignette describing symptoms WITHOUT naming condition/topic
  initialVitals: Vitals;
  clinchingClue: string;
  clinchingClueTimeMinutes: number; // e.g. 15 mins after sim start
  // System-by-system physical exam findings
  examFindingsMap: Record<string, string>; // e.g. 'chest' => 'Bilateral crepitations...', 'cvs' => 'S1 S2 heard...'
  // History findings map
  historyMap: Record<string, string>; // e.g. 'allergies' => 'No known drug allergies.', 'past' => 'Hypertension 5 yrs on enalapril'
  // Investigation results lookup (exact matching or regex pattern)
  investigationsMap: Record<string, {
    resultText: string;
    turnaroundMinutes: number;
    category: OrderCategory;
    isIndicative: boolean; // True if indicated for this condition (false = over-ordering)
  }>;
  // Trajectory milestones for time elapsed without critical treatment
  criticalInterventions: {
    orderOrActionPattern: RegExp;
    name: string;
    targetMilestoneMinutes: number; // e.g. must be given within 60 mins
  }[];
  // Incidental findings pool
  incidentalPool: IncidentalFinding[];
  // Milestones for decision gates binding
  gateMilestones: {
    roleTag: RoleTag;
    patientContext: string;
    consequenceOnWrong: string;
    consequenceOnRight: string;
  }[];
}
