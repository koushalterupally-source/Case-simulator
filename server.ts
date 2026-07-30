import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { DEFAULT_PYQ_INDEX } from './src/data/defaultQBank.js';
import { PYQItem, CaseSession, DecisionGate, IncidentalFinding, OrderResultItem, SimTurn, EndOfCaseScorecard } from './src/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Initialize Google GenAI Server-Side
let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }
  return aiClient;
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
});

// Get default pre-loaded PYQ Index
app.get('/api/qbank/default', (req, res) => {
  res.json({ index: DEFAULT_PYQ_INDEX });
});

// Index Parser: Converts raw text/QBank input into structured PYQ rows
app.post('/api/qbank/parse-index', async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string') {
      res.status(400).json({ error: 'rawText string is required' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      // Fallback parser if API key is missing
      res.json({
        parsedItems: [
          {
            qid: `NEETPG-PARSED-${Math.floor(1000 + Math.random() * 9000)}`,
            exam: 'NEET-PG',
            year: 2023,
            subject: 'Medicine',
            system: 'General',
            topic: 'Clinical Case',
            stem: rawText.slice(0, 150) + '...',
            options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
            correctAnswer: 'A',
            conceptTested: 'Concept extracted from query',
            roleTag: 'DIAGNOSIS',
          },
        ],
        warning: 'Gemini API key not found. Generated fallback index item.',
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `You are an expert medical indexer for Indian PG entrance exams (NEET-PG / INI-CET).
Analyze the following question bank raw text and extract structured questions into JSON array format.

Go through the input and output an array of objects matching this schema:
[
  {
    "qid": "NEETPG-2022-001" (or INICET-2023-012, or CUSTOM-001),
    "exam": "NEET-PG" or "INI-CET" or "CUSTOM",
    "year": 2022 (number),
    "subject": "Medicine" | "Surgery" | "OBGY" | "Pediatrics" | "Pharmacology" | "Pathology" | "PSM" | "Emergency",
    "system": "Cardiology" | "Pulmonology" | "Trauma" | etc,
    "topic": "Short topic name",
    "stem": "Full verbatim question stem",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correctAnswer": "A" | "B" | "C" | "D",
    "conceptTested": "One line summary of concept tested",
    "roleTag": "EMERGENCY" | "DIAGNOSIS" | "INVESTIGATION" | "MANAGEMENT" | "PHARM" | "COMPLICATION" | "PREVENTION" | "BASIC-SCIENCE"
  }
]

Rules:
1. Do not invent questions not present in the input.
2. Ensure options A, B, C, D are clean and concise.
3. Choose roleTag accurately based on clinical phase.

RAW TEXT:
${rawText.slice(0, 8000)}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsedJson = JSON.parse(response.text || '[]');
    res.json({ parsedItems: parsedJson });
  } catch (error: any) {
    console.error('Error in index parser:', error);
    res.status(500).json({ error: error.message || 'Failed to parse index' });
  }
});

// Start a new CCS Case Session
app.post('/api/simulation/start-case', async (req, res) => {
  try {
    const { mode = 'standard', subject = 'Medicine', pyqIndex = DEFAULT_PYQ_INDEX, blindMode = false } = req.body;
    
    // Filter candidate PYQs by subject or mixed
    let candidatePyqs: PYQItem[] = pyqIndex.filter((q: PYQItem) => subject === 'All' || q.subject === subject || subject === 'Mixed');
    if (candidatePyqs.length < 3) {
      candidatePyqs = pyqIndex; // fallback to full pool if filtered pool is too small
    }

    // Determine number of gates (3 for rapid mode, 5-7 for standard)
    const numGates = mode === 'rapid' ? 3 : Math.min(6, candidatePyqs.length);
    
    // Shuffle and pick target PYQs
    const shuffled = [...candidatePyqs].sort(() => 0.5 - Math.random());
    const selectedPyqs = shuffled.slice(0, numGates);

    const ai = getGenAI();

    // Default structure template
    let casePromptText = '';
    if (ai) {
      const pyqDescriptions = selectedPyqs.map((q, idx) => 
        `Gate ${idx + 1} [QID: ${q.qid}] (${q.roleTag} - ${q.topic}): Concept = "${q.conceptTested}". Question stem snippet: "${q.stem.slice(0, 100)}..."`
      ).join('\n');

      const systemPrompt = `You are the master CCS Case Engine for USMLE Step 3 / INI-CET PG medical case simulator.
You are designing a realistic patient presentation for a medical case.
The case must thread through these ${numGates} PYQs seamlessly:
${pyqDescriptions}

Task:
Generate a JSON object with:
1. "patient":
   - "name": realistic Indian name (e.g., Rajesh Kumar, Sunita Sharma)
   - "age": number
   - "gender": "Male" | "Female"
   - "chiefComplaint": "raw complaint, e.g. 3 hours of severe retrosternal chest pain and sweating"
   - "setting": "Emergency Department" or "Outpatient Clinic"
   - "diagnosis": "The true underlying diagnosis, e.g. Acute Anterior Wall MI"
   - "clinchingClue": "e.g. ST elevation V1-V4 on ECG"
   - "clinchingClueTime": "Day 1, 09:20"
   - "initialVitals": { "hr": 110, "bp": "90/60", "rr": 24, "spo2": 92, "temp": "98.6°F", "grbs": 160 }
2. "incidentalFindings": exactly 2 actionable incidental findings planted in lab/imaging results or history:
   [
     {
       "id": "inc-1",
       "title": "Unrelated 8mm Solitary Pulmonary Nodule on Chest X-Ray",
       "description": "Chest X-Ray ordered for chest pain shows an incidental 8mm smooth solitary nodule in the right upper lobe.",
       "correctAction": "Order non-contrast CT chest and arrange pulmonology follow-up in 3 months",
       "status": "unnoticed"
     },
     {
       "id": "inc-2",
       "title": "Subclinical Hypothyroidism / Missed HBV Vaccination",
       "description": "Routine thyroid screening shows elevated TSH 8.5 mIU/L with normal FT4 1.2 ng/dL.",
       "correctAction": "Recheck TSH in 6-8 weeks, no immediate thyroxine required",
       "status": "unnoticed"
     }
   ]
3. "openingVignette": "Raw patient presentation text (3-4 lines). NEVER name the diagnosis! Do not copy the PYQ question stem directly. State age, gender, location, chief complaint, context, and vitals."
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: systemPrompt,
        config: { responseMimeType: 'application/json' },
      });

      try {
        const generated = JSON.parse(response.text || '{}');
        const decisionGates: DecisionGate[] = selectedPyqs.map((pyq, idx) => ({
          id: `gate-${idx + 1}`,
          pyq,
          triggerTurnIndex: idx * 2 + 1, // Gates trigger at logical turn intervals
          patientContext: `Decision point ${idx + 1}: ${pyq.roleTag} phase for ${pyq.topic}`,
        }));

        const initialTurn: SimTurn = {
          turnIndex: 0,
          simTime: { day: 1, hour: 9, minute: 15 },
          location: generated.patient?.setting?.includes('Clinic') ? 'OPD' : 'Emergency',
          whatHappened: generated.openingVignette || 'Patient brought to the department.',
          vitals: generated.patient?.initialVitals || { hr: 104, bp: '100/65', rr: 22, spo2: 94, temp: '98.6°F', grbs: 140 },
          newResults: [],
        };

        const session: CaseSession = {
          id: `case-${Date.now()}`,
          title: `${generated.patient?.name} (${generated.patient?.age}y/o ${generated.patient?.gender}) - ${generated.patient?.chiefComplaint}`,
          mode,
          subject,
          patient: {
            id: `pt-${Date.now()}`,
            name: generated.patient?.name || 'Patient',
            age: generated.patient?.age || 50,
            gender: generated.patient?.gender || 'Male',
            chiefComplaint: generated.patient?.chiefComplaint || 'Chest discomfort',
            setting: generated.patient?.setting || 'Emergency Department',
            initialVitals: generated.patient?.initialVitals || initialTurn.vitals,
            currentVitals: { ...initialTurn.vitals },
            diagnosis: generated.patient?.diagnosis || 'Acute Coronary Syndrome',
            clinchingClue: generated.patient?.clinchingClue || 'ECG changes',
            clinchingClueTime: 'Day 1, 09:30',
          },
          currentLocation: initialTurn.location,
          simTime: { day: 1, hour: 9, minute: 15 },
          turns: [initialTurn],
          pendingOrders: [],
          completedOrders: [],
          historyLog: [],
          examLog: [],
          decisionGates,
          currentGateIndex: -1, // No gate active at turn 0
          incidentalFindings: generated.incidentalFindings || [],
          status: 'active',
          blindMode: !!blindMode,
        };

        res.json({ session });
        return;
      } catch (err) {
        console.error('Failed to parse Gemini generated case, using robust fallback', err);
      }
    }

    // Fallback if AI unavailable
    const decisionGates: DecisionGate[] = selectedPyqs.map((pyq, idx) => ({
      id: `gate-${idx + 1}`,
      pyq,
      triggerTurnIndex: idx * 2 + 1,
      patientContext: `Clinical decision point: ${pyq.topic}`,
    }));

    const firstPyq = selectedPyqs[0] || DEFAULT_PYQ_INDEX[0];

    const fallbackSession: CaseSession = {
      id: `case-${Date.now()}`,
      title: `Emergency Case Presentation - ${firstPyq.topic}`,
      mode,
      subject,
      patient: {
        id: `pt-${Date.now()}`,
        name: 'Ramesh Patel',
        age: 52,
        gender: 'Male',
        chiefComplaint: 'Acute chest heaviness and breathlessness for 2 hours',
        setting: 'Emergency Department',
        initialVitals: { hr: 108, bp: '95/60', rr: 24, spo2: 93, temp: '98.4°F', grbs: 158 },
        currentVitals: { hr: 108, bp: '95/60', rr: 24, spo2: 93, temp: '98.4°F', grbs: 158 },
        diagnosis: firstPyq.topic,
        clinchingClue: firstPyq.conceptTested,
        clinchingClueTime: 'Day 1, 09:30',
      },
      currentLocation: 'Emergency',
      simTime: { day: 1, hour: 9, minute: 15 },
      turns: [
        {
          turnIndex: 0,
          simTime: { day: 1, hour: 9, minute: 15 },
          location: 'Emergency',
          whatHappened: 'A 52-year-old male arrives in Emergency with acute chest distress and sweating. Vitals recorded by triage nurse.',
          vitals: { hr: 108, bp: '95/60', rr: 24, spo2: 93, temp: '98.4°F', grbs: 158 },
          newResults: [],
        },
      ],
      pendingOrders: [],
      completedOrders: [],
      historyLog: [],
      examLog: [],
      decisionGates,
      currentGateIndex: -1,
      incidentalFindings: [
        {
          id: 'inc-1',
          title: 'Incidental 8mm Solitary Pulmonary Nodule on CXR',
          description: 'CXR ordered for chest pain demonstrates an incidental smooth 8mm nodule in the right upper pulmonary lobe.',
          correctAction: 'Order non-contrast CT Chest and recommend follow-up in 3 months',
          status: 'unnoticed',
        },
        {
          id: 'inc-2',
          title: 'Asymptomatic Microcytic Anemia (Hb 9.8 g/dL)',
          description: 'CBC reveals Hb 9.8 g/dL, MCV 72 fL with low serum ferritin 10 ng/mL.',
          correctAction: 'Initiate oral Ferrous Sulfate replacement',
          status: 'unnoticed',
        },
      ],
      status: 'active',
      blindMode: !!blindMode,
    };

    res.json({ session: fallbackSession });
  } catch (error: any) {
    console.error('Error starting case:', error);
    res.status(500).json({ error: error.message || 'Failed to start case' });
  }
});

// Process a User Turn in the Simulation
app.post('/api/simulation/process-turn', async (req, res) => {
  try {
    const { session, userCommand, gateAnswer } = req.body;
    if (!session) {
      res.status(400).json({ error: 'session object is required' });
      return;
    }

    const currentSession: CaseSession = { ...session };
    const currentTurnIndex = currentSession.turns.length;

    // Helper to format sim time
    const formatSimTime = (st: { day: number; hour: number; minute: number }) => {
      const d = st.day;
      const h = String(st.hour).padStart(2, '0');
      const m = String(st.minute).padStart(2, '0');
      return `Day ${d}, ${h}:${m}`;
    };

    // 1. Handling Decision Gate Answer submission
    if (gateAnswer && currentSession.currentGateIndex >= 0) {
      const activeGate = currentSession.decisionGates[currentSession.currentGateIndex];
      const correctAns = activeGate.pyq.correctAnswer;
      const cleanAnswer = String(gateAnswer).trim().toUpperCase();
      
      const isCorrect = cleanAnswer === correctAns || cleanAnswer.startsWith(correctAns);
      activeGate.userAnswer = cleanAnswer;
      activeGate.isCorrect = isCorrect;
      activeGate.explanationGiven = activeGate.pyq.explanation || activeGate.pyq.conceptTested;

      // Realistic Clinical Branching Consequence
      let consequenceText = '';
      if (isCorrect) {
        consequenceText = `✅ Correct choice (${correctAns})! ${activeGate.pyq.conceptTested}. Patient clinical condition stabilizes under your targeted management.`;
        // Improve vitals slightly
        if (currentSession.patient.currentVitals.hr > 80) currentSession.patient.currentVitals.hr -= 8;
        if (currentSession.patient.currentVitals.spo2 < 98) currentSession.patient.currentVitals.spo2 = Math.min(99, currentSession.patient.currentVitals.spo2 + 2);
      } else {
        consequenceText = `❌ Incorrect choice (${cleanAnswer}). Correct answer was (${correctAns}): ${activeGate.pyq.conceptTested}.\nClinical consequence: Delayed targeted therapy leads to transient clinical deterioration! You must take corrective action now.`;
        // Worsen vitals realistically
        currentSession.patient.currentVitals.hr += 10;
        currentSession.patient.currentVitals.bp = '88/55';
        currentSession.patient.currentVitals.spo2 = Math.max(88, currentSession.patient.currentVitals.spo2 - 3);
      }

      activeGate.consequenceMessage = consequenceText;

      // Advance clock by 15 minutes for decision gate execution
      let newMin = currentSession.simTime.minute + 15;
      let newHr = currentSession.simTime.hour;
      let newDay = currentSession.simTime.day;
      if (newMin >= 60) {
        newMin -= 60;
        newHr += 1;
        if (newHr >= 24) {
          newHr -= 24;
          newDay += 1;
        }
      }
      currentSession.simTime = { day: newDay, hour: newHr, minute: newMin };

      // Deactivate gate
      const completedGate = { ...activeGate };
      currentSession.currentGateIndex = -1;

      const gateTurn: SimTurn = {
        turnIndex: currentTurnIndex,
        simTime: { ...currentSession.simTime },
        location: currentSession.currentLocation,
        whatHappened: consequenceText,
        vitals: { ...currentSession.patient.currentVitals },
        newResults: [],
        userCommand: `Decision Gate Answer: ${cleanAnswer}`,
      };

      currentSession.turns.push(gateTurn);

      // Check if all gates done
      const allGatesDone = currentSession.decisionGates.every(g => g.userAnswer !== undefined);
      if (allGatesDone && currentSession.status === 'active') {
        // Can offer option to end or continue
      }

      res.json({ session: currentSession, gateFeedback: { isCorrect, correctAns, explanation: activeGate.explanationGiven, consequence: consequenceText } });
      return;
    }

    // 2. Processing General Commands (order, hx, pe, move to, advance, end case)
    const cmd = String(userCommand || '').trim();
    let turnWhatHappened = '';
    let timeToAdvanceMinutes = 15;
    const newlyCompletedOrders: OrderResultItem[] = [];

    // AI dynamic simulation step
    const ai = getGenAI();

    if (cmd.toLowerCase() === 'end case') {
      currentSession.status = 'completed';
      res.json({ session: currentSession, endRequested: true });
      return;
    }

    // Check movement commands
    if (cmd.toLowerCase().startsWith('move to')) {
      const loc = cmd.slice(7).trim();
      const validLocations = ['Emergency', 'OPD', 'Ward', 'ICU', 'OT', 'Home'];
      const matched = validLocations.find(l => l.toLowerCase() === loc.toLowerCase());
      if (matched) {
        currentSession.currentLocation = matched as any;
        turnWhatHappened = `Patient transferred to ${matched}. Vitals re-evaluated upon arrival.`;
        timeToAdvanceMinutes = 20;
      } else {
        turnWhatHappened = `Transfer requested to "${loc}". Location unavailable. (Available: Emergency, OPD, Ward, ICU, OT, Home).`;
        timeToAdvanceMinutes = 5;
      }
    } 
    // Check advance time commands
    else if (cmd.toLowerCase().startsWith('advance')) {
      const timeStr = cmd.slice(7).trim();
      const mins = parseInt(timeStr) || (timeStr.includes('hour') ? parseInt(timeStr) * 60 : 30);
      timeToAdvanceMinutes = Math.min(1440, Math.max(5, mins));
      turnWhatHappened = `Clock advanced by ${timeToAdvanceMinutes} minutes. Patient monitored closely.`;
    }
    // Check history / physical exam / orders
    else {
      if (ai) {
        const prompt = `You are the CCS Case Engine.
Patient: ${currentSession.patient.name}, ${currentSession.patient.age}y/o ${currentSession.patient.gender}, Diagnosis: ${currentSession.patient.diagnosis}.
Current Vitals: ${JSON.stringify(currentSession.patient.currentVitals)}
Current Location: ${currentSession.currentLocation}
Planted Incidental Findings: ${JSON.stringify(currentSession.incidentalFindings)}
User Command: "${cmd}"

Respond with JSON:
{
  "whatHappened": "Clinical response to the command (2-3 lines). If history question, give realistic patient reply. If physical exam, give detailed exam findings. If order, confirm order placement.",
  "orderResults": [
    {
      "orderName": "Order name",
      "category": "labs" | "imaging" | "drugs" | "consults" | "procedures",
      "resultText": "Realistic lab/imaging/procedure report",
      "turnaroundMinutes": 30
    }
  ],
  "vitalsUpdate": { "hr": number, "bp": "string", "rr": number, "spo2": number, "temp": "string", "grbs": number },
  "incidentalFindingAddressedId": "inc-1" | "inc-2" | null
}
`;
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });

          const resData = JSON.parse(response.text || '{}');
          turnWhatHappened = resData.whatHappened || `Processed command: "${cmd}".`;

          if (resData.vitalsUpdate) {
            currentSession.patient.currentVitals = { ...currentSession.patient.currentVitals, ...resData.vitalsUpdate };
          }

          if (resData.incidentalFindingAddressedId) {
            const inc = currentSession.incidentalFindings.find(i => i.id === resData.incidentalFindingAddressedId);
            if (inc) {
              inc.status = 'noticed_addressed';
            }
          }

          if (Array.isArray(resData.orderResults)) {
            for (const ord of resData.orderResults) {
              const turnaround = ord.turnaroundMinutes || 30;
              const placeTimeStr = formatSimTime(currentSession.simTime);
              
              // Calculate ready time
              let rMin = currentSession.simTime.minute + turnaround;
              let rHr = currentSession.simTime.hour;
              let rDay = currentSession.simTime.day;
              if (rMin >= 60) {
                rHr += Math.floor(rMin / 60);
                rMin = rMin % 60;
                if (rHr >= 24) {
                  rDay += Math.floor(rHr / 24);
                  rHr = rHr % 24;
                }
              }

              const newOrdItem: OrderResultItem = {
                id: `ord-${Date.now()}-${Math.random()}`,
                orderName: ord.orderName,
                category: ord.category || 'labs',
                placedSimTime: placeTimeStr,
                readySimTime: `Day ${rDay}, ${String(rHr).padStart(2, '0')}:${String(rMin).padStart(2, '0')}`,
                isReady: turnaround <= 15, // if quick turn around, ready immediately
                resultText: ord.resultText,
                turnaroundMinutes: turnaround,
              };

              if (newOrdItem.isReady) {
                newlyCompletedOrders.push(newOrdItem);
                currentSession.completedOrders.push(newOrdItem);
              } else {
                currentSession.pendingOrders.push(newOrdItem);
              }
            }
          }
        } catch (err) {
          turnWhatHappened = `Command received: "${cmd}". Orders/interventions executed.`;
        }
      } else {
        turnWhatHappened = `Executed command: "${cmd}". Patient monitored in ${currentSession.currentLocation}.`;
      }
    }

    // Advance clock
    let newMin = currentSession.simTime.minute + timeToAdvanceMinutes;
    let newHr = currentSession.simTime.hour;
    let newDay = currentSession.simTime.day;
    if (newMin >= 60) {
      newHr += Math.floor(newMin / 60);
      newMin = newMin % 60;
      if (newHr >= 24) {
        newDay += Math.floor(newHr / 24);
        newHr = newHr % 24;
      }
    }
    currentSession.simTime = { day: newDay, hour: newHr, minute: newMin };

    // Check pending orders to see if any have become ready!
    const currentSimStr = formatSimTime(currentSession.simTime);
    currentSession.pendingOrders = currentSession.pendingOrders.filter(ord => {
      // compare sim time
      if (ord.readySimTime <= currentSimStr) {
        ord.isReady = true;
        newlyCompletedOrders.push(ord);
        currentSession.completedOrders.push(ord);
        return false;
      }
      return true;
    });

    // Check if next decision gate should trigger!
    let nextGateTriggered = false;
    const unansweredGateIdx = currentSession.decisionGates.findIndex((g, idx) => g.userAnswer === undefined);
    if (unansweredGateIdx >= 0 && currentSession.currentGateIndex === -1) {
      // Trigger gate if turn index matches or reached
      currentSession.currentGateIndex = unansweredGateIdx;
      nextGateTriggered = true;
    }

    const newTurn: SimTurn = {
      turnIndex: currentTurnIndex,
      simTime: { ...currentSession.simTime },
      location: currentSession.currentLocation,
      whatHappened: turnWhatHappened,
      vitals: { ...currentSession.patient.currentVitals },
      newResults: newlyCompletedOrders,
      activeGate: nextGateTriggered ? currentSession.decisionGates[currentSession.currentGateIndex] : undefined,
      userCommand: cmd,
    };

    currentSession.turns.push(newTurn);

    res.json({ session: currentSession, newlyCompletedOrders });
  } catch (error: any) {
    console.error('Error processing turn:', error);
    res.status(500).json({ error: error.message || 'Failed to process turn' });
  }
});

// Generate Comprehensive End-Of-Case Scorecard
app.post('/api/simulation/generate-scorecard', async (req, res) => {
  try {
    const { session } = req.body;
    if (!session) {
      res.status(400).json({ error: 'session object is required' });
      return;
    }

    const currentSession: CaseSession = session;
    const gates = currentSession.decisionGates || [];
    const correctCount = gates.filter(g => g.isCorrect).length;
    const totalGates = gates.length || 1;
    const pyqPercentage = Math.round((correctCount / totalGates) * 100);

    const gateResults = gates.map(g => ({
      qid: g.pyq.qid,
      examYear: `${g.pyq.exam} ${g.pyq.year}`,
      topic: g.pyq.topic,
      roleTag: g.pyq.roleTag,
      userChoice: g.userAnswer || 'Unanswered',
      correctChoice: g.pyq.correctAnswer,
      isCorrect: !!g.isCorrect,
      concept: g.pyq.conceptTested,
      consequence: g.consequenceMessage || 'Standard clinical pathway',
    }));

    // Evaluate Incidental Findings
    const incidentalReport = (currentSession.incidentalFindings || []).map(inc => {
      let scoreNote = 'Missed during diagnostic workup';
      if (inc.status === 'noticed_addressed') {
        scoreNote = 'Excellent! Noticed and properly addressed';
      } else if (inc.status === 'over_investigated') {
        scoreNote = 'Over-investigated unnecessary routine finding';
      }
      return {
        title: inc.title,
        outcome: inc.correctAction,
        status: inc.status,
        scoreNote,
      };
    });

    // Determine Top Concepts to Revise
    const incorrectGates = gates.filter(g => !g.isCorrect);
    const topConceptsToRevise = incorrectGates.map(g => ({
      concept: g.pyq.conceptTested,
      sourceQIDs: [g.pyq.qid],
    }));

    // Compute Overall Grade
    let overallGrade: 'S' | 'A' | 'B' | 'C' | 'F' = 'B';
    if (pyqPercentage >= 90) overallGrade = 'S';
    else if (pyqPercentage >= 75) overallGrade = 'A';
    else if (pyqPercentage >= 60) overallGrade = 'B';
    else if (pyqPercentage >= 40) overallGrade = 'C';
    else overallGrade = 'F';

    const scorecard: EndOfCaseScorecard = {
      finalDiagnosis: currentSession.patient.diagnosis,
      clinchingClue: currentSession.patient.clinchingClue,
      clinchingTime: currentSession.patient.clinchingClueTime,
      pyqScore: {
        correct: correctCount,
        total: totalGates,
        percentage: pyqPercentage,
      },
      gateResults,
      incidentalFindingsReport: incidentalReport,
      criticalDelays: pyqPercentage < 60 ? ['Delayed initiation of definitive therapy at Decision Gate 1'] : [],
      overOrderingList: currentSession.completedOrders.length > 8 ? ['Excessive non-targeted lab panels requested'] : [],
      preventionChecklist: [
        { item: 'Vaccination & outpatient counseling discussed', status: 'missed' },
        { item: 'Secondary prevention & medication reconciliation', status: 'done' },
      ],
      topConceptsToRevise,
      overallGrade,
      overallScore: Math.round(pyqPercentage * 0.8 + (incidentalReport.filter(i => i.status === 'noticed_addressed').length * 10)),
      summaryFeedback: `Completed Case ${currentSession.title}. Solved ${correctCount}/${totalGates} NEET-PG/INI-CET Decision Gates correctly.`,
    };

    currentSession.scorecard = scorecard;
    currentSession.status = 'completed';

    res.json({ scorecard, session: currentSession });
  } catch (error: any) {
    console.error('Error generating scorecard:', error);
    res.status(500).json({ error: error.message || 'Failed to generate scorecard' });
  }
});

// Case State Block Export / Resume
app.post('/api/simulation/state-block', (req, res) => {
  const { session } = req.body;
  if (!session) {
    res.status(400).json({ error: 'session object is required' });
    return;
  }

  const compressedBlock = `CASE_STATE_BLOCK
Patient: ${session.patient.name} (${session.patient.age} ${session.patient.gender})
Diagnosis: ${session.patient.diagnosis}
SimTime: Day ${session.simTime.day}, ${String(session.simTime.hour).padStart(2, '0')}:${String(session.simTime.minute).padStart(2, '0')}
Location: ${session.currentLocation}
Gates Completed: ${session.decisionGates.filter((g: any) => g.userAnswer).length}/${session.decisionGates.length}
Incidental Findings Noticed: ${session.incidentalFindings.filter((i: any) => i.status === 'noticed_addressed').length}/2
Status: ${session.status}
END_STATE_BLOCK`;

  res.json({ stateBlock: compressedBlock });
});

// Vite middleware or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PYQ CCS Simulator Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
