/**
 * Pure Deterministic Temporal Tape Evaluation Engine
 * 
 * CORE ARCHITECTURAL PRINCIPLE:
 * Models Propose. Deterministic Server Code Decides.
 * 
 * This module has ZERO dependencies on:
 * - Gemini / LLMs
 * - Firestore / Database SDKs
 * - Express / Network transports
 * - External clock (when evaluatedAt timestamp is injected)
 */

export type SupportedMetric = 'stressIndex' | 'focusIndex' | 'creativityIndex';
export type ComparisonOperator = 'lte' | 'gte';

export interface TapeUnlockPolicy {
  metric: SupportedMetric;
  operator: ComparisonOperator;
  threshold: number;         // 1 to 10
  sustainedDays: number;     // non-negative number of days required
  minObservations: number;   // integer >= 1
  minConfidence?: number;    // 0.0 to 1.0
}

export interface TelemetryObservation {
  id?: string;
  timestamp: number;         // Unix epoch in milliseconds
  stressIndex: number;
  focusIndex: number;
  creativityIndex: number;
  confidence?: number;       // 0.0 to 1.0
}

export interface TapeEvaluationInput {
  tapeId?: string;
  currentStatus: 'sealed' | 'unlocked' | string;
  policy: TapeUnlockPolicy;
  observations: TelemetryObservation[];
  evaluatedAt?: number;      // Optional injected timestamp for strict determinism
}

export type EvaluationRejectionCode =
  | 'ALREADY_UNLOCKED'
  | 'INVALID_POLICY'
  | 'NO_OBSERVATIONS'
  | 'INVALID_OBSERVATIONS'
  | 'THRESHOLD_VIOLATION'
  | 'INSUFFICIENT_DURATION'
  | 'INSUFFICIENT_COUNT'
  | 'INSUFFICIENT_CONFIDENCE';

export interface TapeEvaluationResult {
  eligible: boolean;
  reason: string;
  userMessage?: string;
  currentStreakDays: number;
  observationCount: number;
  confidence: number;
  evaluatedAt: number;
  rejectionCode?: EvaluationRejectionCode;
  violatingValue?: number;
  currentScore?: number;
  targetThreshold?: number;
}

const VALID_METRICS: readonly SupportedMetric[] = ['stressIndex', 'focusIndex', 'creativityIndex'];
const VALID_OPERATORS: readonly ComparisonOperator[] = ['lte', 'gte'];
const MS_PER_DAY = 86_400_000; // 24 * 60 * 60 * 1000

function getMetricLabel(metric: SupportedMetric): string {
  switch (metric) {
    case 'stressIndex': return 'stress';
    case 'focusIndex': return 'focus';
    case 'creativityIndex': return 'creativity';
    default: return String(metric);
  }
}

function getOperatorPhrase(operator: ComparisonOperator): string {
  return operator === 'lte' ? 'at most' : 'at least';
}

/**
 * Deterministically evaluates whether a Temporal Tape's unlock policy
 * is fully satisfied by the provided longitudinal telemetry observations.
 */
export function evaluateTapePolicy(input: TapeEvaluationInput): TapeEvaluationResult {
  const evaluatedAt = typeof input.evaluatedAt === 'number' && !Number.isNaN(input.evaluatedAt)
    ? input.evaluatedAt
    : Date.now();

  // 1. Guard against re-unlocking already-unlocked tapes
  if (input.currentStatus === 'unlocked') {
    return {
      eligible: false,
      reason: 'This tape is already unlocked and its message is available.',
      currentStreakDays: 0,
      observationCount: Array.isArray(input.observations) ? input.observations.length : 0,
      confidence: 1.0,
      evaluatedAt,
      rejectionCode: 'ALREADY_UNLOCKED',
    };
  }

  // 2. Validate unlock policy schema and bounded constraints
  const policy = input.policy;
  if (!policy || typeof policy !== 'object') {
    return {
      eligible: false,
      reason: 'Unlock policy is required and must be an object.',
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'INVALID_POLICY',
    };
  }

  if (!VALID_METRICS.includes(policy.metric)) {
    return {
      eligible: false,
      reason: `Invalid metric: "${String(policy.metric)}". Supported metrics: ${VALID_METRICS.join(', ')}.`,
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'INVALID_POLICY',
    };
  }

  if (!VALID_OPERATORS.includes(policy.operator)) {
    return {
      eligible: false,
      reason: `Invalid comparison operator: "${String(policy.operator)}". Supported operators: ${VALID_OPERATORS.join(', ')}.`,
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'INVALID_POLICY',
    };
  }

  if (typeof policy.threshold !== 'number' || Number.isNaN(policy.threshold) || policy.threshold < 1 || policy.threshold > 10) {
    return {
      eligible: false,
      reason: `Threshold must be a valid number between 1 and 10. Received: ${policy.threshold}.`,
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'INVALID_POLICY',
    };
  }

  if (typeof policy.sustainedDays !== 'number' || Number.isNaN(policy.sustainedDays) || policy.sustainedDays < 0) {
    return {
      eligible: false,
      reason: `sustainedDays must be a non-negative number. Received: ${policy.sustainedDays}.`,
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'INVALID_POLICY',
    };
  }

  if (typeof policy.minObservations !== 'number' || Number.isNaN(policy.minObservations) || policy.minObservations < 1 || !Number.isInteger(policy.minObservations)) {
    return {
      eligible: false,
      reason: `minObservations must be an integer >= 1. Received: ${policy.minObservations}.`,
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'INVALID_POLICY',
    };
  }

  if (policy.minConfidence !== undefined) {
    if (typeof policy.minConfidence !== 'number' || Number.isNaN(policy.minConfidence) || policy.minConfidence < 0 || policy.minConfidence > 1) {
      return {
        eligible: false,
        reason: `minConfidence must be a number between 0.0 and 1.0. Received: ${policy.minConfidence}.`,
        currentStreakDays: 0,
        observationCount: 0,
        confidence: 0,
        evaluatedAt,
        rejectionCode: 'INVALID_POLICY',
      };
    }
  }

  // 3. Validate observation presence
  const rawObservations = input.observations;
  if (!Array.isArray(rawObservations) || rawObservations.length === 0) {
    return {
      eligible: false,
      reason: 'Your tape is still sealed. No journal reflections have been recorded yet.',
      userMessage: 'Your tape is still sealed. No journal reflections have been recorded yet.',
      currentStreakDays: 0,
      observationCount: 0,
      confidence: 0,
      evaluatedAt,
      rejectionCode: 'NO_OBSERVATIONS',
    };
  }

  // 4. Validate & sort observations chronologically
  const sortedObservations: TelemetryObservation[] = [];
  for (let i = 0; i < rawObservations.length; i++) {
    const obs = rawObservations[i];
    if (!obs || typeof obs !== 'object') {
      return {
        eligible: false,
        reason: `Malformed observation at index ${i}.`,
        currentStreakDays: 0,
        observationCount: 0,
        confidence: 0,
        evaluatedAt,
        rejectionCode: 'INVALID_OBSERVATIONS',
      };
    }

    if (typeof obs.timestamp !== 'number' || Number.isNaN(obs.timestamp) || obs.timestamp <= 0) {
      return {
        eligible: false,
        reason: `Invalid timestamp in observation at index ${i}.`,
        currentStreakDays: 0,
        observationCount: 0,
        confidence: 0,
        evaluatedAt,
        rejectionCode: 'INVALID_OBSERVATIONS',
      };
    }

    const metricValue = obs[policy.metric];
    if (typeof metricValue !== 'number' || Number.isNaN(metricValue)) {
      return {
        eligible: false,
        reason: `Required metric "${policy.metric}" is missing or non-numeric in observation at timestamp ${obs.timestamp}.`,
        currentStreakDays: 0,
        observationCount: 0,
        confidence: 0,
        evaluatedAt,
        rejectionCode: 'INVALID_OBSERVATIONS',
      };
    }

    sortedObservations.push(obs);
  }

  sortedObservations.sort((a, b) => a.timestamp - b.timestamp);

  const observationCount = sortedObservations.length;
  const firstTimestamp = sortedObservations[0].timestamp;
  const lastTimestamp = sortedObservations[observationCount - 1].timestamp;
  const durationMs = Math.max(0, lastTimestamp - firstTimestamp);
  const currentStreakDays = Number((durationMs / MS_PER_DAY).toFixed(2));

  // Compute aggregate confidence
  let totalConfidence = 0;
  for (const obs of sortedObservations) {
    const conf = typeof obs.confidence === 'number' && !Number.isNaN(obs.confidence) ? obs.confidence : 1.0;
    totalConfidence += conf;
  }
  const averageConfidence = Number((totalConfidence / observationCount).toFixed(3));

  // 5. Threshold Verification: Every observation in the candidate window must satisfy the operator
  for (const obs of sortedObservations) {
    const value = obs[policy.metric];
    const satisfies = policy.operator === 'lte' ? value <= policy.threshold : value >= policy.threshold;

    if (!satisfies) {
      const metricLabel = getMetricLabel(policy.metric);
      const opPhrase = getOperatorPhrase(policy.operator);
      let reason = `Your tape is still sealed. Your current ${metricLabel} score is ${value}/10, while this tape requires ${opPhrase} ${policy.threshold}/10.`;
      if (policy.sustainedDays > 0 || policy.minObservations > 1) {
        reason += ` Progress: 0 of ${policy.sustainedDays} qualifying days and 0 of ${policy.minObservations} required observations.`;
      }

      return {
        eligible: false,
        reason,
        userMessage: reason,
        currentStreakDays,
        observationCount,
        confidence: averageConfidence,
        evaluatedAt,
        rejectionCode: 'THRESHOLD_VIOLATION',
        violatingValue: value,
        currentScore: value,
        targetThreshold: policy.threshold,
      };
    }
  }

  // 6. Minimum Observation Count Check
  if (observationCount < policy.minObservations) {
    let reason = `Your tape is still sealed. Observation count (${observationCount}) is below required minimum (${policy.minObservations}).`;
    if (policy.sustainedDays > 0) {
      reason = `Your tape is still sealed. Progress: ${currentStreakDays} of ${policy.sustainedDays} qualifying days and ${observationCount} of ${policy.minObservations} required observations.`;
    }
    return {
      eligible: false,
      reason,
      userMessage: reason,
      currentStreakDays,
      observationCount,
      confidence: averageConfidence,
      evaluatedAt,
      rejectionCode: 'INSUFFICIENT_COUNT',
      targetThreshold: policy.threshold,
    };
  }

  // 7. Sustained Duration Window Check
  if (currentStreakDays < policy.sustainedDays) {
    const reason = `Your tape is still sealed. Progress: ${currentStreakDays} of ${policy.sustainedDays} qualifying days and ${observationCount} of ${policy.minObservations} required observations.`;
    return {
      eligible: false,
      reason,
      userMessage: reason,
      currentStreakDays,
      observationCount,
      confidence: averageConfidence,
      evaluatedAt,
      rejectionCode: 'INSUFFICIENT_DURATION',
      targetThreshold: policy.threshold,
    };
  }

  // 8. Confidence Check
  const requiredConfidence = policy.minConfidence ?? 0.0;
  if (averageConfidence < requiredConfidence) {
    const reason = `Your tape is still sealed. Telemetry confidence is building (${averageConfidence})—continue journaling to reach required verification (${requiredConfidence}).`;
    return {
      eligible: false,
      reason,
      userMessage: reason,
      currentStreakDays,
      observationCount,
      confidence: averageConfidence,
      evaluatedAt,
      rejectionCode: 'INSUFFICIENT_CONFIDENCE',
      targetThreshold: policy.threshold,
    };
  }

  // 9. All deterministic conditions satisfied
  const metricLabel = getMetricLabel(policy.metric);
  const opPhrase = getOperatorPhrase(policy.operator);
  const successReason = `All unlock conditions met: ${metricLabel} maintained ${opPhrase} ${policy.threshold}/10 over ${currentStreakDays} days across ${observationCount} observations.`;
  return {
    eligible: true,
    reason: successReason,
    userMessage: 'Condition satisfied. This tape is now unlocked.',
    currentStreakDays,
    observationCount,
    confidence: averageConfidence,
    evaluatedAt,
    targetThreshold: policy.threshold,
  };
}
