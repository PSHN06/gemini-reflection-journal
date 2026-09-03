export type ReflectionMode = 'reflection' | 'brainstorm' | 'summary' | 'socratic';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string; // Current draft or initial reflection text
  mode: ReflectionMode;
  tags: string[];
  mood?: string;
  messages: ChatMessage[]; // Multi-turn reflection history
  summary?: string;
  lastGeminiModel?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserInteractionRecord {
  id?: string;
  userId: string;
  entryId: string;
  prompt: string;
  response: string;
  model: string;
  mode: string;
  timestamp: number;
}

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface TelemetryMetrics {
  stressIndex: number;
  focusIndex: number;
  creativityIndex: number;
  dominantThemes: string[];
}

export type TapeStatus = 'sealed' | 'evaluating' | 'unlocked';

export interface TapeUnlockCondition {
  metric: 'stressIndex' | 'focusIndex' | 'creativityIndex';
  operator: 'lte' | 'gte';
  threshold: number;         // 1 to 10
  sustainedDays: number;     // non-negative number
  minObservations: number;   // integer >= 1
  minConfidence?: number;    // 0.0 to 1.0
}

export interface UnlockEvidence {
  unlockedAt: number;
  evaluatedAt: number;
  currentStreakDays: number;
  observationCount: number;
  confidence: number;
  reason: string;
  threshold: number;
  metric: string;
  operator: string;
  satisfied: boolean;
  firstEligibleDate?: number;
  lastEligibleDate?: number;
  averageMetricScore?: number;
}

export interface EvaluationProgress {
  currentStreakDays: number;
  currentObservationCount: number;
  lastEvaluatedAt: number | null;
  satisfactionPercentage: number;
  lastReason?: string;
}

export interface TemporalTape {
  tapeId: string;
  ownerUid: string;
  title: string;
  sealedProse?: string; // Omitted when status is 'sealed'
  recipientNote: string;
  status: TapeStatus;
  condition: TapeUnlockCondition;
  sealedAt: number;
  createdAt: number;
  updatedAt: number;
  unlockedAt: number | null;
  unlockEvidence: UnlockEvidence | null;
  evaluationProgress: EvaluationProgress | null;
  policyVersion: number;
}

export interface TelemetryLedgerEntry {
  telemetryId: string;
  entryId: string;
  ownerUid: string;
  recordedAt: number;
  stressIndex: number;
  focusIndex: number;
  creativityIndex: number;
  dominantThemes: string[];
  confidenceScore: number;
  evidenceQuotes: string[];
  modelUsed: string;
  isDeterministicFallback: boolean;
  schemaVersion: number;
}

export interface TapeEvaluationLog {
  evaluationId: string;
  tapeId: string;
  evaluatedAt: number;
  satisfied: boolean;
  observationsExamined: number;
  currentStreakDays: number;
  confidence: number;
  reason: string;
  evaluatorVersion: string;
}

export interface EvaluateTapeResponse {
  success: boolean;
  eligible: boolean;
  alreadyUnlocked?: boolean;
  status: TapeStatus;
  reason: string;
  currentStreakDays: number;
  observationCount: number;
  confidence: number;
  evaluatedAt: number;
  tape: TemporalTape;
}

