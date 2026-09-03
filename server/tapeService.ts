import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getAdminDb } from './firebaseAdmin';
import { evaluateTapePolicy, TapeUnlockPolicy, TelemetryObservation } from './tapeEngine';
import {
  TemporalTape,
  TapeUnlockCondition,
  UnlockEvidence,
  EvaluationProgress,
  TelemetryLedgerEntry,
  TapeEvaluationLog,
} from '../src/types';

export interface SealTapeInput {
  title: string;
  sealedProse: string;
  recipientNote?: string;
  condition: TapeUnlockCondition;
}

export interface TelemetryLedgerInput {
  entryId?: string;
  stressIndex: number;
  focusIndex: number;
  creativityIndex: number;
  dominantThemes?: string[];
  confidenceScore?: number;
  evidenceQuotes?: string[];
  modelUsed?: string;
  isDeterministicFallback?: boolean;
  recordedAt?: number;
}

/**
 * Sanitizes a Temporal Tape object before returning it over the network.
 * 
 * CORE SECURITY INVARIANT:
 * If a tape is SEALED (or not unlocked), sealedProse is completely deleted.
 * Only when status is UNLOCKED is sealedProse included.
 */
export function sanitizeTapeForClient(tape: TemporalTape): TemporalTape {
  const isUnlocked = tape.status === 'unlocked';
  const copy: TemporalTape = {
    tapeId: tape.tapeId,
    ownerUid: tape.ownerUid,
    title: tape.title,
    recipientNote: tape.recipientNote || '',
    status: tape.status,
    condition: tape.condition,
    sealedAt: tape.sealedAt,
    createdAt: tape.createdAt,
    updatedAt: tape.updatedAt,
    unlockedAt: tape.unlockedAt || null,
    unlockEvidence: tape.unlockEvidence || null,
    evaluationProgress: tape.evaluationProgress || null,
    policyVersion: tape.policyVersion || 1,
  };

  if (isUnlocked) {
    copy.sealedProse = tape.sealedProse;
  }
  // If not unlocked, copy.sealedProse is omitted from JSON payload

  return copy;
}

/**
 * Validates condition input against strict policy constraints.
 */
export function validateCondition(condition: any): { valid: boolean; error?: string } {
  if (!condition || typeof condition !== 'object') {
    return { valid: false, error: 'Condition policy must be an object.' };
  }

  const validMetrics = ['stressIndex', 'focusIndex', 'creativityIndex'];
  if (!validMetrics.includes(condition.metric)) {
    return { valid: false, error: `Metric must be one of: ${validMetrics.join(', ')}.` };
  }

  const validOperators = ['lte', 'gte'];
  if (!validOperators.includes(condition.operator)) {
    return { valid: false, error: `Operator must be one of: ${validOperators.join(', ')}.` };
  }

  if (typeof condition.threshold !== 'number' || Number.isNaN(condition.threshold) || condition.threshold < 1 || condition.threshold > 10) {
    return { valid: false, error: 'Threshold must be a number between 1 and 10.' };
  }

  if (typeof condition.sustainedDays !== 'number' || Number.isNaN(condition.sustainedDays) || condition.sustainedDays < 0) {
    return { valid: false, error: 'sustainedDays must be a non-negative number.' };
  }

  if (typeof condition.minObservations !== 'number' || Number.isNaN(condition.minObservations) || condition.minObservations < 1 || !Number.isInteger(condition.minObservations)) {
    return { valid: false, error: 'minObservations must be an integer >= 1.' };
  }

  if (condition.minConfidence !== undefined) {
    if (typeof condition.minConfidence !== 'number' || Number.isNaN(condition.minConfidence) || condition.minConfidence < 0 || condition.minConfidence > 1) {
      return { valid: false, error: 'minConfidence must be a number between 0.0 and 1.0.' };
    }
  }

  return { valid: true };
}

// ==================== STORAGE ABSTRACTION ====================
// Supports live Firestore with seamless fallback to disk-backed persistent storage
// when running in sandbox/testing environments lacking service account IAM keys.

interface StoreData {
  tapes: Record<string, TemporalTape>; // key: `${uid}:${tapeId}`
  telemetry: Record<string, TelemetryLedgerEntry[]>; // key: uid
  evaluations: Record<string, TapeEvaluationLog[]>; // key: `${uid}:${tapeId}`
}

let isLiveFirestoreAvailable: boolean | null = null;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'temporal_store.json');

let memoryStore: StoreData = {
  tapes: {},
  telemetry: {},
  evaluations: {},
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLocalStore(): StoreData {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[Local Store] Read error:', err);
  }
  return { tapes: {}, telemetry: {}, evaluations: {} };
}

function saveLocalStore(data: StoreData) {
  try {
    ensureDataDir();
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.warn('[Local Store] Write error:', err);
  }
}

// Initialize memory store from disk
memoryStore = loadLocalStore();

export async function checkLiveFirestore(): Promise<boolean> {
  if (isLiveFirestoreAvailable !== null) {
    return isLiveFirestoreAvailable;
  }
  try {
    const db = getAdminDb();
    await db.collection('_healthcheck').limit(1).get();
    isLiveFirestoreAvailable = true;
    console.log('[Persistence Mode] Live Cloud Firestore is ACTIVE and verified.');
  } catch (err: any) {
    isLiveFirestoreAvailable = false;
    console.log('[Persistence Mode] Firestore is UNAVAILABLE in this environment. Disk-backed local fallback is ACTIVE (.data/temporal_store.json). Note:', err?.message || 'Credentials not present');
  }
  return isLiveFirestoreAvailable;
}

export async function initPersistenceMode(): Promise<'firestore' | 'local_disk'> {
  const isLive = await checkLiveFirestore();
  return isLive ? 'firestore' : 'local_disk';
}

// ----------------- Data Access Operations -----------------

async function dbSaveTape(tape: TemporalTape): Promise<void> {
  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      await db.collection('users').doc(tape.ownerUid).collection('tapes').doc(tape.tapeId).set(tape);
      return;
    } catch (err) {
      console.warn('[Firestore] Failed writing tape, fallback to local store:', err);
    }
  }

  const key = `${tape.ownerUid}:${tape.tapeId}`;
  memoryStore.tapes[key] = { ...tape };
  saveLocalStore(memoryStore);
}

async function dbGetTape(uid: string, tapeId: string): Promise<TemporalTape | null> {
  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      const doc = await db.collection('users').doc(uid).collection('tapes').doc(tapeId).get();
      if (!doc.exists) return null;
      const data = doc.data() as TemporalTape;
      return data.ownerUid === uid ? data : null;
    } catch (err) {
      console.warn('[Firestore] Failed getting tape, fallback to local store:', err);
    }
  }

  const key = `${uid}:${tapeId}`;
  const tape = memoryStore.tapes[key];
  if (!tape || tape.ownerUid !== uid) {
    return null;
  }
  return { ...tape };
}

async function dbListTapes(uid: string): Promise<TemporalTape[]> {
  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      const snap = await db.collection('users').doc(uid).collection('tapes').get();
      const list: TemporalTape[] = [];
      snap.forEach((doc) => list.push(doc.data() as TemporalTape));
      return list;
    } catch (err) {
      console.warn('[Firestore] Failed listing tapes, fallback to local store:', err);
    }
  }

  const list: TemporalTape[] = [];
  for (const [k, tape] of Object.entries(memoryStore.tapes)) {
    if (k.startsWith(`${uid}:`) && tape.ownerUid === uid) {
      list.push({ ...tape });
    }
  }
  return list;
}

async function dbSaveTelemetry(entry: TelemetryLedgerEntry): Promise<void> {
  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      await db.collection('users').doc(entry.ownerUid).collection('telemetry_ledger').doc(entry.telemetryId).set(entry);
      return;
    } catch (err) {
      console.warn('[Firestore] Failed saving telemetry to ledger, fallback to local store:', err);
    }
  }

  if (!memoryStore.telemetry[entry.ownerUid]) {
    memoryStore.telemetry[entry.ownerUid] = [];
  }
  memoryStore.telemetry[entry.ownerUid].push({ ...entry });
  saveLocalStore(memoryStore);
}

async function dbListTelemetry(uid: string): Promise<TelemetryObservation[]> {
  const observations: TelemetryObservation[] = [];
  const seenTimestamps = new Set<number>();

  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      const snap = await db.collection('users').doc(uid).collection('telemetry_ledger').get();
      snap.forEach((doc) => {
        const data = doc.data() as TelemetryLedgerEntry;
        if (typeof data.recordedAt === 'number' && typeof data.stressIndex === 'number') {
          seenTimestamps.add(data.recordedAt);
          observations.push({
            id: data.telemetryId || doc.id,
            timestamp: data.recordedAt,
            stressIndex: data.stressIndex,
            focusIndex: data.focusIndex,
            creativityIndex: data.creativityIndex,
            confidence: data.confidenceScore ?? 0.85,
          });
        }
      });
      return observations;
    } catch (err) {
      console.warn('[Firestore] Failed listing telemetry from ledger, fallback to local store:', err);
    }
  }

  const entries = memoryStore.telemetry[uid] || [];
  for (const data of entries) {
    if (typeof data.recordedAt === 'number' && typeof data.stressIndex === 'number') {
      seenTimestamps.add(data.recordedAt);
      observations.push({
        id: data.telemetryId,
        timestamp: data.recordedAt,
        stressIndex: data.stressIndex,
        focusIndex: data.focusIndex,
        creativityIndex: data.creativityIndex,
        confidence: data.confidenceScore ?? 0.85,
      });
    }
  }

  return observations;
}

async function dbExecuteUnlockTransaction(
  uid: string,
  tapeId: string,
  evidence: UnlockEvidence,
  progress: EvaluationProgress,
  log: TapeEvaluationLog
): Promise<{ newlyUnlocked: boolean; tape: TemporalTape }> {
  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      const tapeRef = db.collection('users').doc(uid).collection('tapes').doc(tapeId);
      const evalRef = tapeRef.collection('evaluations').doc(log.evaluationId);

      let finalTape: TemporalTape | null = null;
      let newlyUnlocked = false;

      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(tapeRef);
        if (!snap.exists) throw new Error('Tape not found');
        const current = snap.data() as TemporalTape;

        if (current.status === 'unlocked') {
          finalTape = current;
          newlyUnlocked = false;
          return;
        }

        const updates: Partial<TemporalTape> = {
          status: 'unlocked',
          unlockedAt: evidence.unlockedAt,
          updatedAt: evidence.unlockedAt,
          unlockEvidence: evidence,
          evaluationProgress: progress,
        };

        transaction.update(tapeRef, updates);
        transaction.set(evalRef, log);

        finalTape = { ...current, ...updates };
        newlyUnlocked = true;
      });

      if (finalTape) {
        return { newlyUnlocked, tape: finalTape };
      }
    } catch (err) {
      console.warn('[Firestore] Transaction failed on Firestore, falling back to local store:', err);
    }
  }

  // Local Transaction Simulation
  const key = `${uid}:${tapeId}`;
  const current = memoryStore.tapes[key];
  if (!current) {
    throw new Error('Tape not found.');
  }

  // Idempotency check
  if (current.status === 'unlocked') {
    return { newlyUnlocked: false, tape: { ...current } };
  }

  const updated: TemporalTape = {
    ...current,
    status: 'unlocked',
    unlockedAt: evidence.unlockedAt,
    updatedAt: evidence.unlockedAt,
    unlockEvidence: evidence,
    evaluationProgress: progress,
  };

  memoryStore.tapes[key] = updated;

  if (!memoryStore.evaluations[key]) {
    memoryStore.evaluations[key] = [];
  }
  memoryStore.evaluations[key].push(log);
  saveLocalStore(memoryStore);

  return { newlyUnlocked: true, tape: updated };
}

async function dbUpdateProgress(
  uid: string,
  tapeId: string,
  progress: EvaluationProgress,
  log: TapeEvaluationLog,
  evaluatedAt: number
): Promise<TemporalTape> {
  const useLive = await checkLiveFirestore();
  if (useLive) {
    try {
      const db = getAdminDb();
      const tapeRef = db.collection('users').doc(uid).collection('tapes').doc(tapeId);
      const evalRef = tapeRef.collection('evaluations').doc(log.evaluationId);

      await tapeRef.update({
        updatedAt: evaluatedAt,
        evaluationProgress: progress,
      });
      await evalRef.set(log);

      const snap = await tapeRef.get();
      return snap.data() as TemporalTape;
    } catch {
      isLiveFirestoreAvailable = false;
    }
  }

  const key = `${uid}:${tapeId}`;
  const current = memoryStore.tapes[key];
  if (!current) {
    throw new Error('Tape not found.');
  }

  const updated: TemporalTape = {
    ...current,
    updatedAt: evaluatedAt,
    evaluationProgress: progress,
  };

  memoryStore.tapes[key] = updated;
  if (!memoryStore.evaluations[key]) {
    memoryStore.evaluations[key] = [];
  }
  memoryStore.evaluations[key].push(log);
  saveLocalStore(memoryStore);

  return updated;
}

// ==================== SERVICE EXPORTS ====================

/**
 * Seals a new Temporal Tape.
 */
export async function sealTape(uid: string, input: SealTapeInput): Promise<TemporalTape> {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Valid authenticated UID is required.');
  }

  const title = (input.title || '').trim();
  if (!title || title.length > 200) {
    throw new Error('Title is required and must be 200 characters or fewer.');
  }

  const sealedProse = (input.sealedProse || '').trim();
  if (!sealedProse || sealedProse.length > 50000) {
    throw new Error('Sealed prose is required and must be 50,000 characters or fewer.');
  }

  const recipientNote = (input.recipientNote || '').trim();
  if (recipientNote.length > 500) {
    throw new Error('Recipient note must be 500 characters or fewer.');
  }

  const condValidation = validateCondition(input.condition);
  if (!condValidation.valid) {
    throw new Error(`Invalid unlock condition: ${condValidation.error}`);
  }

  const now = Date.now();
  const tapeId = `tape_${now}_${crypto.randomBytes(4).toString('hex')}`;

  const tapeDoc: TemporalTape = {
    tapeId,
    ownerUid: uid,
    title,
    sealedProse, // Stored securely on the backend
    recipientNote,
    status: 'sealed',
    condition: {
      metric: input.condition.metric,
      operator: input.condition.operator,
      threshold: input.condition.threshold,
      sustainedDays: input.condition.sustainedDays,
      minObservations: input.condition.minObservations,
      minConfidence: input.condition.minConfidence ?? 0.7,
    },
    sealedAt: now,
    createdAt: now,
    updatedAt: now,
    unlockedAt: null,
    unlockEvidence: null,
    evaluationProgress: {
      currentStreakDays: 0,
      currentObservationCount: 0,
      lastEvaluatedAt: null,
      satisfactionPercentage: 0,
      lastReason: 'Sealed. Awaiting baseline telemetry evaluations.',
    },
    policyVersion: 1,
  };

  await dbSaveTape(tapeDoc);

  // Return sanitized version (without sealedProse)
  return sanitizeTapeForClient(tapeDoc);
}

/**
 * Returns all tapes belonging to the authenticated user.
 * Sealed tapes have sealedProse stripped.
 */
export async function getTapesForUser(uid: string): Promise<TemporalTape[]> {
  const list = await dbListTapes(uid);
  const tapes = list.map(sanitizeTapeForClient);
  tapes.sort((a, b) => b.createdAt - a.createdAt);
  return tapes;
}

/**
 * Returns a specific tape for the authenticated user.
 * Strictly verifies ownership.
 */
export async function getTapeById(uid: string, tapeId: string): Promise<TemporalTape | null> {
  const tape = await dbGetTape(uid, tapeId);
  if (!tape || tape.ownerUid !== uid) {
    return null;
  }
  return sanitizeTapeForClient(tape);
}

/**
 * Records a validated telemetry observation to the immutable ledger.
 */
export async function recordTelemetryToLedger(
  uid: string,
  input: TelemetryLedgerInput
): Promise<TelemetryLedgerEntry> {
  if (!uid) {
    throw new Error('Authenticated UID is required.');
  }

  const stress = Number(input.stressIndex);
  const focus = Number(input.focusIndex);
  const creativity = Number(input.creativityIndex);

  if (Number.isNaN(stress) || stress < 1 || stress > 10) {
    throw new Error('stressIndex must be a number between 1 and 10.');
  }
  if (Number.isNaN(focus) || focus < 1 || focus > 10) {
    throw new Error('focusIndex must be a number between 1 and 10.');
  }
  if (Number.isNaN(creativity) || creativity < 1 || creativity > 10) {
    throw new Error('creativityIndex must be a number between 1 and 10.');
  }

  const now = input.recordedAt || Date.now();
  const telemetryId = `ledger_${now}_${crypto.randomBytes(4).toString('hex')}`;
  const entryId = input.entryId || `entry_auto_${now}`;

  const entry: TelemetryLedgerEntry = {
    telemetryId,
    entryId,
    ownerUid: uid,
    recordedAt: now,
    stressIndex: stress,
    focusIndex: focus,
    creativityIndex: creativity,
    dominantThemes: Array.isArray(input.dominantThemes) ? input.dominantThemes.slice(0, 10) : [],
    confidenceScore: typeof input.confidenceScore === 'number' ? Math.max(0, Math.min(1, input.confidenceScore)) : 0.85,
    evidenceQuotes: Array.isArray(input.evidenceQuotes) ? input.evidenceQuotes.slice(0, 5) : [],
    modelUsed: input.modelUsed || 'gemini-3.6-flash',
    isDeterministicFallback: Boolean(input.isDeterministicFallback),
    schemaVersion: 1,
  };

  await dbSaveTelemetry(entry);
  return entry;
}

export interface EvaluateTapeResponse {
  success: boolean;
  eligible: boolean;
  alreadyUnlocked?: boolean;
  status: 'sealed' | 'evaluating' | 'unlocked';
  reason: string;
  currentStreakDays: number;
  observationCount: number;
  confidence: number;
  evaluatedAt: number;
  tape: TemporalTape;
}

/**
 * Server-authoritative, deterministic Temporal Tape evaluation.
 * Performs transactional unlock if eligible.
 */
export async function evaluateTape(
  uid: string,
  tapeId: string,
  injectedNow?: number
): Promise<EvaluateTapeResponse> {
  const evaluatedAt = injectedNow || Date.now();

  const tape = await dbGetTape(uid, tapeId);
  if (!tape) {
    throw new Error('Tape not found.');
  }
  if (tape.ownerUid !== uid) {
    throw new Error('Unauthorized: Tape does not belong to the authenticated user.');
  }

  // Fast-path: Already unlocked tapes cannot be re-unlocked (Irreversible & Idempotent)
  if (tape.status === 'unlocked') {
    return {
      success: true,
      eligible: false,
      alreadyUnlocked: true,
      status: 'unlocked',
      reason: 'Tape is already unlocked. State transitions from unlocked are irreversible.',
      currentStreakDays: tape.evaluationProgress?.currentStreakDays ?? 0,
      observationCount: tape.evaluationProgress?.currentObservationCount ?? 0,
      confidence: tape.unlockEvidence?.confidence ?? 1.0,
      evaluatedAt,
      tape: sanitizeTapeForClient(tape),
    };
  }

  // Load validated telemetry observations
  const rawObservations = await dbListTelemetry(uid);
  rawObservations.sort((a, b) => a.timestamp - b.timestamp);

  // Pass observations + policy to pure deterministic tapeEngine
  const engineResult = evaluateTapePolicy({
    tapeId,
    currentStatus: tape.status,
    policy: tape.condition as TapeUnlockPolicy,
    observations: rawObservations,
    evaluatedAt,
  });

  const evalId = `eval_${evaluatedAt}_${crypto.randomBytes(4).toString('hex')}`;

  // If ELIGIBLE: Execute Transactional Unlock
  if (engineResult.eligible) {
    const evidence: UnlockEvidence = {
      unlockedAt: evaluatedAt,
      evaluatedAt,
      currentStreakDays: engineResult.currentStreakDays,
      observationCount: engineResult.observationCount,
      confidence: engineResult.confidence,
      reason: engineResult.reason,
      threshold: tape.condition.threshold,
      metric: tape.condition.metric,
      operator: tape.condition.operator,
      satisfied: true,
    };

    const progress: EvaluationProgress = {
      currentStreakDays: engineResult.currentStreakDays,
      currentObservationCount: engineResult.observationCount,
      lastEvaluatedAt: evaluatedAt,
      satisfactionPercentage: 100,
      lastReason: engineResult.reason,
    };

    const logEntry: TapeEvaluationLog = {
      evaluationId: evalId,
      tapeId,
      evaluatedAt,
      satisfied: true,
      observationsExamined: engineResult.observationCount,
      currentStreakDays: engineResult.currentStreakDays,
      confidence: engineResult.confidence,
      reason: engineResult.reason,
      evaluatorVersion: '1.0.0-deterministic',
    };

    const result = await dbExecuteUnlockTransaction(uid, tapeId, evidence, progress, logEntry);

    return {
      success: true,
      eligible: true,
      status: 'unlocked',
      reason: engineResult.reason,
      currentStreakDays: engineResult.currentStreakDays,
      observationCount: engineResult.observationCount,
      confidence: engineResult.confidence,
      evaluatedAt,
      // Status is 'unlocked', so sealedProse is safely revealed!
      tape: sanitizeTapeForClient(result.tape),
    };
  }

  // If NOT ELIGIBLE: Update evaluation progress without unlocking
  const streakPct = tape.condition.sustainedDays > 0
    ? Math.min(100, (engineResult.currentStreakDays / tape.condition.sustainedDays) * 100)
    : 100;
  const countPct = Math.min(100, (engineResult.observationCount / tape.condition.minObservations) * 100);
  const overallPct = Math.floor((streakPct + countPct) / 2);

  const updatedProgress: EvaluationProgress = {
    currentStreakDays: engineResult.currentStreakDays,
    currentObservationCount: engineResult.observationCount,
    lastEvaluatedAt: evaluatedAt,
    satisfactionPercentage: overallPct,
    lastReason: engineResult.reason,
  };

  const logEntry: TapeEvaluationLog = {
    evaluationId: evalId,
    tapeId,
    evaluatedAt,
    satisfied: false,
    observationsExamined: engineResult.observationCount,
    currentStreakDays: engineResult.currentStreakDays,
    confidence: engineResult.confidence,
    reason: engineResult.reason,
    evaluatorVersion: '1.0.0-deterministic',
  };

  const updatedTape = await dbUpdateProgress(uid, tapeId, updatedProgress, logEntry, evaluatedAt);

  return {
    success: true,
    eligible: false,
    status: 'sealed',
    reason: engineResult.reason,
    currentStreakDays: engineResult.currentStreakDays,
    observationCount: engineResult.observationCount,
    confidence: engineResult.confidence,
    evaluatedAt,
    // Status is 'sealed', so sealedProse remains stripped
    tape: sanitizeTapeForClient(updatedTape),
  };
}

// Alias export for recordTelemetry
export const recordTelemetry = recordTelemetryToLedger;
