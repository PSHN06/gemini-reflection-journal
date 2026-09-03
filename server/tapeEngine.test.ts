/**
 * Unit Test Suite for Deterministic Temporal Tape Evaluator
 * 
 * Verifies all 10 core invariant requirements:
 * 1. stress <= 4 and all observations satisfy threshold -> eligible when duration/count/confidence are satisfied
 * 2. One observation violates threshold -> not eligible
 * 3. Duration shorter than sustainedDays -> not eligible
 * 4. Observation count below minObservations -> not eligible
 * 5. Confidence below minConfidence -> not eligible
 * 6. Exact threshold boundary -> correct result
 * 7. Invalid metric -> rejected safely
 * 8. Invalid operator -> rejected safely
 * 9. Invalid threshold/range -> rejected safely
 * 10. Duplicate evaluation -> deterministic same result
 */

import { evaluateTapePolicy, TapeUnlockPolicy, TelemetryObservation } from './tapeEngine';

const MS_PER_DAY = 86_400_000;
const BASE_TIME = 1772600000000; // Fixed deterministic baseline timestamp

function createObservations(
  stressValues: number[],
  dayOffsets: number[],
  confidences?: number[]
): TelemetryObservation[] {
  return stressValues.map((stress, idx) => ({
    id: `obs-${idx}`,
    timestamp: BASE_TIME + (dayOffsets[idx] * MS_PER_DAY),
    stressIndex: stress,
    focusIndex: 7,
    creativityIndex: 6,
    confidence: confidences ? confidences[idx] : 0.9,
  }));
}

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${description}`, details || '');
    failed++;
  }
}

console.log('--- RUNNING DETERMINISTIC TAPE ENGINE TEST SUITE ---');

// Test 1: stress <= 4 and all observations satisfy threshold -> eligible
{
  const policy: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 7,
    minObservations: 4,
    minConfidence: 0.8,
  };
  const observations = createObservations([3, 2, 4, 3], [0, 2, 5, 7]);
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy,
    observations,
    evaluatedAt: BASE_TIME + (8 * MS_PER_DAY),
  });

  assert(
    'Test 1: stress <= 4 across 7 days with 4 entries is eligible',
    result.eligible === true && result.currentStreakDays >= 7 && result.observationCount === 4,
    result
  );
}

// Test 2: One observation violates threshold -> not eligible
{
  const policy: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 7,
    minObservations: 4,
  };
  const observations = createObservations([3, 2, 7, 3], [0, 2, 5, 7]); // Day 5 stress is 7 (violation)
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy,
    observations,
    evaluatedAt: BASE_TIME + (8 * MS_PER_DAY),
  });

  assert(
    'Test 2: Single threshold violation rejects unlock',
    result.eligible === false && result.rejectionCode === 'THRESHOLD_VIOLATION',
    result
  );
}

// Test 3: Duration shorter than sustainedDays -> not eligible
{
  const policy: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 7,
    minObservations: 4,
  };
  const observations = createObservations([3, 2, 3, 2], [0, 1, 2, 3]); // Only 3 days duration
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy,
    observations,
    evaluatedAt: BASE_TIME + (4 * MS_PER_DAY),
  });

  assert(
    'Test 3: Insufficient duration rejects unlock (3 days vs 7 required)',
    result.eligible === false && result.rejectionCode === 'INSUFFICIENT_DURATION',
    result
  );
}

// Test 4: Observation count below minObservations -> not eligible
{
  const policy: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 7,
    minObservations: 6, // Requires 6
  };
  const observations = createObservations([3, 2, 3], [0, 4, 8]); // Only 3 observations
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy,
    observations,
    evaluatedAt: BASE_TIME + (9 * MS_PER_DAY),
  });

  assert(
    'Test 4: Low observation count rejects unlock (3 vs 6 required)',
    result.eligible === false && result.rejectionCode === 'INSUFFICIENT_COUNT',
    result
  );
}

// Test 5: Confidence below minConfidence -> not eligible
{
  const policy: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 7,
    minObservations: 4,
    minConfidence: 0.85,
  };
  const observations = createObservations([3, 2, 3, 2], [0, 2, 5, 7], [0.5, 0.6, 0.4, 0.5]); // Avg = 0.5
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy,
    observations,
    evaluatedAt: BASE_TIME + (8 * MS_PER_DAY),
  });

  assert(
    'Test 5: Low confidence rejects unlock (0.50 vs 0.85 required)',
    result.eligible === false && result.rejectionCode === 'INSUFFICIENT_CONFIDENCE',
    result
  );
}

// Test 6: Exact threshold boundary -> correct result
{
  const policyLte: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 5,
    minObservations: 3,
  };
  const observationsExactLte = createObservations([4, 4, 4], [0, 2, 5]);
  const resultLte = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy: policyLte,
    observations: observationsExactLte,
  });

  assert(
    'Test 6a: Exact boundary for lte (4 <= 4) is eligible',
    resultLte.eligible === true,
    resultLte
  );

  const policyGte: TapeUnlockPolicy = {
    metric: 'focusIndex',
    operator: 'gte',
    threshold: 7,
    sustainedDays: 5,
    minObservations: 3,
  };
  const observationsExactGte = [
    { timestamp: BASE_TIME, stressIndex: 2, focusIndex: 7, creativityIndex: 5 },
    { timestamp: BASE_TIME + (2 * MS_PER_DAY), stressIndex: 2, focusIndex: 7, creativityIndex: 5 },
    { timestamp: BASE_TIME + (5 * MS_PER_DAY), stressIndex: 2, focusIndex: 7, creativityIndex: 5 },
  ];
  const resultGte = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy: policyGte,
    observations: observationsExactGte,
  });

  assert(
    'Test 6b: Exact boundary for gte (7 >= 7) is eligible',
    resultGte.eligible === true,
    resultGte
  );
}

// Test 7: Invalid metric -> rejected safely
{
  const invalidPolicy = {
    metric: 'happinessScore' as any,
    operator: 'lte' as const,
    threshold: 5,
    sustainedDays: 5,
    minObservations: 3,
  };
  const observations = createObservations([3, 2, 3], [0, 2, 5]);
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy: invalidPolicy,
    observations,
  });

  assert(
    'Test 7: Unsupported metric rejected safely with INVALID_POLICY',
    result.eligible === false && result.rejectionCode === 'INVALID_POLICY',
    result
  );
}

// Test 8: Invalid operator -> rejected safely
{
  const invalidPolicy = {
    metric: 'stressIndex' as const,
    operator: 'equals' as any,
    threshold: 5,
    sustainedDays: 5,
    minObservations: 3,
  };
  const observations = createObservations([3, 2, 3], [0, 2, 5]);
  const result = evaluateTapePolicy({
    currentStatus: 'sealed',
    policy: invalidPolicy,
    observations,
  });

  assert(
    'Test 8: Unsupported operator rejected safely with INVALID_POLICY',
    result.eligible === false && result.rejectionCode === 'INVALID_POLICY',
    result
  );
}

// Test 9: Invalid threshold/range -> rejected safely
{
  const invalidThresholdLow = {
    metric: 'stressIndex' as const,
    operator: 'lte' as const,
    threshold: 0, // Below 1
    sustainedDays: 5,
    minObservations: 3,
  };
  const invalidThresholdHigh = {
    metric: 'stressIndex' as const,
    operator: 'lte' as const,
    threshold: 15, // Above 10
    sustainedDays: 5,
    minObservations: 3,
  };
  const observations = createObservations([3, 2, 3], [0, 2, 5]);
  
  const resLow = evaluateTapePolicy({ currentStatus: 'sealed', policy: invalidThresholdLow, observations });
  const resHigh = evaluateTapePolicy({ currentStatus: 'sealed', policy: invalidThresholdHigh, observations });

  assert(
    'Test 9: Out-of-bounds thresholds (0 and 15) rejected with INVALID_POLICY',
    resLow.eligible === false && resLow.rejectionCode === 'INVALID_POLICY' &&
    resHigh.eligible === false && resHigh.rejectionCode === 'INVALID_POLICY',
    { resLow, resHigh }
  );
}

// Test 10: Duplicate evaluation -> deterministic identical result
{
  const policy: TapeUnlockPolicy = {
    metric: 'creativityIndex',
    operator: 'gte',
    threshold: 6,
    sustainedDays: 3,
    minObservations: 3,
    minConfidence: 0.75,
  };
  const observations = [
    { timestamp: BASE_TIME, stressIndex: 3, focusIndex: 6, creativityIndex: 8, confidence: 0.9 },
    { timestamp: BASE_TIME + (2 * MS_PER_DAY), stressIndex: 3, focusIndex: 6, creativityIndex: 7, confidence: 0.8 },
    { timestamp: BASE_TIME + (4 * MS_PER_DAY), stressIndex: 3, focusIndex: 6, creativityIndex: 9, confidence: 0.85 },
  ];

  const eval1 = evaluateTapePolicy({ currentStatus: 'sealed', policy, observations, evaluatedAt: 1234567890 });
  const eval2 = evaluateTapePolicy({ currentStatus: 'sealed', policy, observations, evaluatedAt: 1234567890 });

  assert(
    'Test 10: Repeated evaluations with identical inputs produce bitwise deterministic results',
    JSON.stringify(eval1) === JSON.stringify(eval2) && eval1.eligible === true,
    { eval1, eval2 }
  );
}

// Extra Test: Already-unlocked tape cannot be re-unlocked
{
  const policy: TapeUnlockPolicy = {
    metric: 'stressIndex',
    operator: 'lte',
    threshold: 4,
    sustainedDays: 0,
    minObservations: 1,
  };
  const observations = createObservations([2], [0]);
  const result = evaluateTapePolicy({
    currentStatus: 'unlocked',
    policy,
    observations,
  });

  assert(
    'Extra Test: Already-unlocked tape cannot be re-unlocked (ALREADY_UNLOCKED)',
    result.eligible === false && result.rejectionCode === 'ALREADY_UNLOCKED',
    result
  );
}

console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
