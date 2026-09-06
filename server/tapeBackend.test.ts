import assert from 'assert';
import http from 'http';
import {
  sealTape,
  getTapesForUser,
  getTapeById,
  evaluateTape,
  recordTelemetryToLedger,
  autoEvaluateUserSealedTapes,
  validateCondition,
  sanitizeTapeForClient,
} from './tapeService';
import { TemporalTape, TapeUnlockCondition } from '../src/types';

// Helper to execute HTTP requests against the live server
function makeHttpRequest(options: http.RequestOptions, body?: string): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        let parsed = chunks;
        try {
          parsed = JSON.parse(chunks);
        } catch {}
        resolve({ statusCode: res.statusCode || 0, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTemporalTapeBackendTests() {
  console.log('\n--- RUNNING COMPLETE TEMPORAL TAPE BACKEND TEST SUITE ---\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return Promise.resolve()
      .then(fn)
      .then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      })
      .catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error('    Error:', err.message);
        failed++;
      });
  }

  // ==================== 1. HTTP AUTHENTICATION TESTS ====================

  await test('Auth Test 1: POST /api/tapes/seal without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/tapes/seal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ title: 'Test Tape' }));
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  await test('Auth Test 2: GET /api/tapes without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/tapes',
      method: 'GET',
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  await test('Auth Test 3: GET /api/tapes/:tapeId without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/tapes/tape_nonexistent_123',
      method: 'GET',
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  await test('Auth Test 4: POST /api/tapes/:tapeId/evaluate without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/tapes/tape_nonexistent_123/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  await test('Auth Test 5: POST /api/telemetry/record without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/telemetry/record',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ stressIndex: 3, focusIndex: 8, creativityIndex: 7 }));
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  await test('Auth Test 6: Malformed Bearer token is rejected with 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/tapes',
      method: 'GET',
      headers: { Authorization: 'Bearer forged.invalid.token' },
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await test('Auth Test 7: POST /api/gemini/reflect without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/gemini/reflect',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ prompt: 'Hello world' }));
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  await test('Auth Test 8: POST /api/gemini/telemetry without token returns 401', async () => {
    const res = await makeHttpRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/gemini/telemetry',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ content: 'Feeling calm today' }));
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.data.code, 'UNAUTHORIZED');
  });

  // ==================== 2. INPUT VALIDATION & SECURITY ====================

  await test('Validation Test 1: Invalid metric rejected by validateCondition', () => {
    const res = validateCondition({
      metric: 'happinessMetric',
      operator: 'lte',
      threshold: 4,
      sustainedDays: 7,
      minObservations: 4,
    });
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Metric must be one of/);
  });

  await test('Validation Test 2: Invalid operator rejected by validateCondition', () => {
    const res = validateCondition({
      metric: 'stressIndex',
      operator: 'like',
      threshold: 4,
      sustainedDays: 7,
      minObservations: 4,
    });
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Operator must be one of/);
  });

  await test('Validation Test 3: Out of bounds threshold rejected (0 and 11)', () => {
    const resZero = validateCondition({
      metric: 'stressIndex',
      operator: 'lte',
      threshold: 0,
      sustainedDays: 7,
      minObservations: 4,
    });
    assert.strictEqual(resZero.valid, false);

    const resEleven = validateCondition({
      metric: 'stressIndex',
      operator: 'lte',
      threshold: 11,
      sustainedDays: 7,
      minObservations: 4,
    });
    assert.strictEqual(resEleven.valid, false);
  });

  await test('Validation Test 4: Negative sustainedDays or non-integer minObservations rejected', () => {
    const resNeg = validateCondition({
      metric: 'stressIndex',
      operator: 'lte',
      threshold: 4,
      sustainedDays: -3,
      minObservations: 4,
    });
    assert.strictEqual(resNeg.valid, false);

    const resFloat = validateCondition({
      metric: 'stressIndex',
      operator: 'lte',
      threshold: 4,
      sustainedDays: 7,
      minObservations: 2.5,
    });
    assert.strictEqual(resFloat.valid, false);
  });

  // ==================== 3. LOCKED CONTENT PROTECTION INVARIANTS ====================

  await test('Locking Invariant 1: Sealed tape never returns sealedProse over client boundary', () => {
    const mockSealedTape: TemporalTape = {
      tapeId: 'tape_test_1',
      ownerUid: 'user_123',
      title: 'Letter to my future calm self',
      sealedProse: 'CLASSIFIED_SEALED_CONTENT_NEVER_LEAK',
      recipientNote: 'Open when stress is consistently <= 3 for 14 days.',
      status: 'sealed',
      condition: {
        metric: 'stressIndex',
        operator: 'lte',
        threshold: 3,
        sustainedDays: 14,
        minObservations: 5,
      },
      sealedAt: 1700000000000,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      unlockedAt: null,
      unlockEvidence: null,
      evaluationProgress: null,
      policyVersion: 1,
    };

    const sanitized = sanitizeTapeForClient(mockSealedTape);
    assert.strictEqual(sanitized.sealedProse, undefined, 'sealedProse MUST be undefined on sealed tapes');
    assert.strictEqual(sanitized.title, 'Letter to my future calm self');
    assert.strictEqual(sanitized.status, 'sealed');
  });

  await test('Locking Invariant 2: Unlocked tape safely reveals sealedProse', () => {
    const mockUnlockedTape: TemporalTape = {
      tapeId: 'tape_test_2',
      ownerUid: 'user_123',
      title: 'Letter to my future calm self',
      sealedProse: 'REVEALED_CONTENT_YOU_HAVE_FOUND_PEACE',
      recipientNote: 'Open when calm',
      status: 'unlocked',
      condition: {
        metric: 'stressIndex',
        operator: 'lte',
        threshold: 3,
        sustainedDays: 14,
        minObservations: 5,
      },
      sealedAt: 1700000000000,
      createdAt: 1700000000000,
      updatedAt: 1700100000000,
      unlockedAt: 1700100000000,
      unlockEvidence: {
        unlockedAt: 1700100000000,
        evaluatedAt: 1700100000000,
        currentStreakDays: 14,
        observationCount: 6,
        confidence: 0.92,
        reason: 'Condition satisfied',
        threshold: 3,
        metric: 'stressIndex',
        operator: 'lte',
        satisfied: true,
      },
      evaluationProgress: null,
      policyVersion: 1,
    };

    const sanitized = sanitizeTapeForClient(mockUnlockedTape);
    assert.strictEqual(sanitized.sealedProse, 'REVEALED_CONTENT_YOU_HAVE_FOUND_PEACE');
    assert.strictEqual(sanitized.status, 'unlocked');
    assert.notStrictEqual(sanitized.unlockEvidence, null);
  });

  // ==================== 4. AUTHORIZATION & CROSS-USER ISOLATION ====================

  const testUserA = `test_user_a_${Date.now()}`;
  const testUserB = `test_user_b_${Date.now()}`;

  let createdTapeId = '';

  await test('End-to-End Tape Lifecycle 1: User A seals a Temporal Tape', async () => {
    const tape = await sealTape(testUserA, {
      title: 'User A Confidential Vault Tape',
      sealedProse: 'Top secret personal prose that should only unlock when creativity is high',
      recipientNote: 'Unlocks when creativity >= 7 for 3 days',
      condition: {
        metric: 'creativityIndex',
        operator: 'gte',
        threshold: 7,
        sustainedDays: 3,
        minObservations: 3,
        minConfidence: 0.8,
      },
    });

    assert.ok(tape.tapeId.startsWith('tape_'));
    assert.strictEqual(tape.ownerUid, testUserA);
    assert.strictEqual(tape.status, 'sealed');
    assert.strictEqual(tape.sealedProse, undefined, 'Sealed prose must NOT be in client response');
    createdTapeId = tape.tapeId;
  });

  await test('End-to-End Tape Lifecycle 2: User B cannot access User A tape (Authorization Barrier)', async () => {
    const tapeForUserB = await getTapeById(testUserB, createdTapeId);
    assert.strictEqual(tapeForUserB, null, 'User B must not be able to fetch User A tape');
  });

  await test('End-to-End Tape Lifecycle 3: User B cannot evaluate User A tape (Anti-Cross-Tenant Hijack)', async () => {
    let errorCaught = false;
    try {
      await evaluateTape(testUserB, createdTapeId);
    } catch (err: any) {
      errorCaught = true;
      assert.match(err.message, /Tape not found|Unauthorized/);
    }
    assert.strictEqual(errorCaught, true, 'User B must not be allowed to trigger evaluation on User A tape');
  });

  // ==================== 5. DETERMINISTIC EVALUATIONS ====================

  const dayMs = 86400000;
  const baseTime = 1710000000000;

  await test('Evaluation Invariant 1: Insufficient observations leaves tape SEALED with calm informational progress', async () => {
    // Record only 1 observation when 3 are required
    await recordTelemetryToLedger(testUserA, {
      entryId: 'entry_1',
      creativityIndex: 8,
      stressIndex: 3,
      focusIndex: 7,
      confidenceScore: 0.9,
    });

    const evalResult = await evaluateTape(testUserA, createdTapeId, baseTime);
    assert.strictEqual(evalResult.eligible, false);
    assert.strictEqual(evalResult.status, 'sealed');
    assert.strictEqual(evalResult.outcome, 'sealed_count_incomplete');
    assert.ok(evalResult.userMessage?.includes('still sealed'));
    assert.ok(!evalResult.userMessage?.includes('violates'));
    assert.strictEqual(evalResult.tape.sealedProse, undefined);
  });

  await test('Evaluation Invariant 2: Threshold condition not met returns calm informational progress, not error', async () => {
    // Record second observation with creativityIndex below threshold (e.g. 5 < 7)
    await recordTelemetryToLedger(testUserA, {
      entryId: 'entry_2',
      creativityIndex: 5, // Fails condition (requires >= 7)
      stressIndex: 4,
      focusIndex: 6,
      confidenceScore: 0.9,
    });

    const evalResult = await evaluateTape(testUserA, createdTapeId, baseTime + dayMs);
    assert.strictEqual(evalResult.eligible, false);
    assert.strictEqual(evalResult.status, 'sealed');
    assert.strictEqual(evalResult.outcome, 'sealed_threshold_not_met');
    assert.ok(evalResult.userMessage?.includes('Your tape is still sealed'));
    assert.ok(evalResult.userMessage?.includes('creativity score is 5/10'));
    assert.ok(evalResult.userMessage?.includes('at least 7/10'));
    assert.ok(!evalResult.userMessage?.includes('violates gte'), 'Must not expose raw violates gte message');
    assert.ok(!evalResult.userMessage?.includes('Threshold condition violated'), 'Must not expose technical violation phrase');
    assert.strictEqual(evalResult.tape.sealedProse, undefined);
  });

  await test('Evaluation UX Case (Screenshot Fix): Focus score 5 with target >= 7 yields calm message without raw violation syntax', async () => {
    const focusUser = `user_focus_check_${Date.now()}`;
    const focusTape = await sealTape(focusUser, {
      title: 'Focus Mastery Tape',
      sealedProse: 'High focus attained',
      condition: {
        metric: 'focusIndex',
        operator: 'gte',
        threshold: 7,
        sustainedDays: 5,
        minObservations: 4,
      },
    });

    await recordTelemetryToLedger(focusUser, {
      entryId: 'entry_focus_5',
      focusIndex: 5, // Violates gte 7
      stressIndex: 3,
      creativityIndex: 6,
      confidenceScore: 0.9,
    });

    const evalResult = await evaluateTape(focusUser, focusTape.tapeId);
    assert.strictEqual(evalResult.eligible, false);
    assert.strictEqual(evalResult.status, 'sealed');
    assert.strictEqual(evalResult.outcome, 'sealed_threshold_not_met');
    assert.strictEqual(
      evalResult.userMessage,
      'Your tape is still sealed. Your current focus score is 5/10, while this tape requires at least 7/10. Progress: 0 of 5 qualifying days and 0 of 4 required observations.'
    );
    assert.ok(!evalResult.userMessage.includes('violates gte 7'));
    assert.ok(!evalResult.userMessage.includes('Threshold condition violated'));
  });

  await test('Evaluation Invariant 3: Qualifying observations over required duration triggers TRANSACTIONAL UNLOCK', async () => {
    // Now seal a new test tape with exact known conditions to test successful unlock:
    // Metric: stressIndex <= 4, sustainedDays: 2, minObservations: 2
    const unlockTestUser = `user_unlock_${Date.now()}`;
    const qualifyingTape = await sealTape(unlockTestUser, {
      title: 'Peaceful Horizon Tape',
      sealedProse: 'CONGRATULATIONS: You have successfully maintained low stress levels!',
      recipientNote: 'Opens when stress <= 4 across 2 days',
      condition: {
        metric: 'stressIndex',
        operator: 'lte',
        threshold: 4,
        sustainedDays: 2,
        minObservations: 2,
        minConfidence: 0.8,
      },
    });

    // Record observation on Day 0
    await recordTelemetryToLedger(unlockTestUser, {
      entryId: 'entry_day0',
      recordedAt: baseTime,
      stressIndex: 3,
      focusIndex: 8,
      creativityIndex: 7,
      confidenceScore: 0.92,
    });

    // Record qualifying observation on Day 2
    const day2Timestamp = baseTime + (2 * dayMs);
    await recordTelemetryToLedger(unlockTestUser, {
      entryId: 'entry_day2',
      recordedAt: day2Timestamp,
      stressIndex: 2,
      focusIndex: 9,
      creativityIndex: 8,
      confidenceScore: 0.95,
    });

    // Evaluate at day2Timestamp
    const evalResult = await evaluateTape(unlockTestUser, qualifyingTape.tapeId, day2Timestamp);

    assert.strictEqual(evalResult.eligible, true, 'Evaluation should be eligible');
    assert.strictEqual(evalResult.status, 'unlocked', 'Tape status should now be unlocked');
    assert.ok(evalResult.tape.unlockedAt !== null, 'unlockedAt must be populated');
    assert.ok(evalResult.tape.unlockEvidence !== null, 'unlockEvidence must be populated');
    assert.strictEqual(evalResult.tape.unlockEvidence.satisfied, true);
    assert.strictEqual(evalResult.tape.sealedProse, 'CONGRATULATIONS: You have successfully maintained low stress levels!');

    // Verify fetched tape independently from Firestore
    const fetchedUnlockedTape = await getTapeById(unlockTestUser, qualifyingTape.tapeId);
    assert.ok(fetchedUnlockedTape !== null);
    assert.strictEqual(fetchedUnlockedTape?.status, 'unlocked');
    assert.strictEqual(fetchedUnlockedTape?.sealedProse, 'CONGRATULATIONS: You have successfully maintained low stress levels!');
  });

  await test('Evaluation Invariant 4: IDEMPOTENCY — Evaluating an already unlocked tape does NOT re-unlock or alter state', async () => {
    const unlockTestUser = `user_idempotent_${Date.now()}`;
    const testTape = await sealTape(unlockTestUser, {
      title: 'Idempotency Test Tape',
      sealedProse: 'Idempotency secret prose',
      condition: {
        metric: 'focusIndex',
        operator: 'gte',
        threshold: 5,
        sustainedDays: 0,
        minObservations: 1,
      },
    });

    await recordTelemetryToLedger(unlockTestUser, {
      entryId: 'entry_f1',
      focusIndex: 8,
      stressIndex: 3,
      creativityIndex: 7,
      confidenceScore: 0.9,
    });

    // First evaluation -> unlocks
    const firstEval = await evaluateTape(unlockTestUser, testTape.tapeId);
    assert.strictEqual(firstEval.status, 'unlocked');
    assert.strictEqual(firstEval.eligible, true);
    const initialUnlockedAt = firstEval.tape.unlockedAt;

    // Second evaluation -> returns alreadyUnlocked: true, preserves exact unlockedAt
    const secondEval = await evaluateTape(unlockTestUser, testTape.tapeId);
    assert.strictEqual(secondEval.status, 'unlocked');
    assert.strictEqual(secondEval.alreadyUnlocked, true);
    assert.strictEqual(secondEval.tape.unlockedAt, initialUnlockedAt, 'unlockedAt must be immutable');
  });

  // ==================== 6. MANUAL END-TO-END VERTICAL SLICE ====================

  await test('Vertical Slice: Journal Entry -> Telemetry Ledger -> Tape Sealed -> Evaluated (Sealed) -> Qualifying Entry -> Evaluated (Unlocked) -> Prose Revealed', async () => {
    const sliceUser = `user_slice_${Date.now()}`;
    const strangerUser = `user_stranger_${Date.now()}`;
    const startTime = 1715000000000;
    const sliceDayMs = 86400000;

    // 1. Journal Entry 1: Telemetry analysis recorded to ledger
    const ledgerEntry1 = await recordTelemetryToLedger(sliceUser, {
      entryId: 'entry_day1_mindful',
      recordedAt: startTime,
      stressIndex: 3, // Qualifying (<= 4)
      focusIndex: 8,
      creativityIndex: 7,
      confidenceScore: 0.92,
      dominantThemes: ['calm', 'clarity'],
      modelUsed: 'gemini-3.6-flash',
    });
    assert.ok(ledgerEntry1.telemetryId.startsWith('ledger_'));
    assert.strictEqual(ledgerEntry1.ownerUid, sliceUser);
    assert.strictEqual(ledgerEntry1.stressIndex, 3);

    // 2. User creates & seals a Temporal Tape with deterministic unlock policy
    const tape = await sealTape(sliceUser, {
      title: 'Letter to my calm future self',
      sealedProse: 'You have found steady calm and sustained resilience. Never forget how you reached this point.',
      recipientNote: 'Unlocks when stress <= 4 across at least 1 sustained day with 2 entries.',
      condition: {
        metric: 'stressIndex',
        operator: 'lte',
        threshold: 4,
        sustainedDays: 1,
        minObservations: 2,
        minConfidence: 0.8,
      },
    });

    assert.ok(tape.tapeId.startsWith('tape_'));
    assert.strictEqual(tape.status, 'sealed');
    assert.strictEqual(tape.sealedProse, undefined, 'Zero-leakage invariant: sealed prose must NOT be in client response');

    // 3. Evaluate tape immediately: only 1 observation exists -> Tape remains SEALED
    const eval1 = await evaluateTape(sliceUser, tape.tapeId, startTime + 3600000);
    assert.strictEqual(eval1.eligible, false);
    assert.strictEqual(eval1.status, 'sealed');
    assert.strictEqual(eval1.tape.sealedProse, undefined, 'Sealed prose remains concealed');
    assert.strictEqual(eval1.outcome, 'sealed_count_incomplete');
    assert.ok(eval1.userMessage?.includes('still sealed'));

    // 4. Journal Entry 2: Second qualifying reflection recorded 1.5 days later
    const day2Time = startTime + Math.floor(1.5 * sliceDayMs);
    const ledgerEntry2 = await recordTelemetryToLedger(sliceUser, {
      entryId: 'entry_day2_peaceful',
      recordedAt: day2Time,
      stressIndex: 2, // Qualifying (<= 4)
      focusIndex: 9,
      creativityIndex: 8,
      confidenceScore: 0.95,
      dominantThemes: ['peace', 'focus'],
      modelUsed: 'gemini-3.6-flash',
    });
    assert.ok(ledgerEntry2.telemetryId.startsWith('ledger_'));

    // 5. Evaluate tape again: both observations qualify, duration 1.5 days >= 1 day -> TRANSACTIONAL UNLOCK
    const eval2 = await evaluateTape(sliceUser, tape.tapeId, day2Time);
    assert.strictEqual(eval2.eligible, true, 'Condition criteria must now be satisfied');
    assert.strictEqual(eval2.status, 'unlocked', 'Tape status must transition to unlocked');
    assert.strictEqual(
      eval2.tape.sealedProse,
      'You have found steady calm and sustained resilience. Never forget how you reached this point.',
      'Sealed prose must be safely revealed upon transactional unlock'
    );
    assert.ok(eval2.tape.unlockedAt !== null);
    assert.strictEqual(eval2.tape.unlockEvidence?.satisfied, true);

    // 6. Security verification: stranger cannot access the unlocked tape
    const strangerAttempt = await getTapeById(strangerUser, tape.tapeId);
    assert.strictEqual(strangerAttempt, null, 'Stranger must NOT be able to view User tape even after unlocking');

    // 7. Re-fetch by owner confirms persistent unlocked state
    const ownerFetch = await getTapeById(sliceUser, tape.tapeId);
    assert.ok(ownerFetch !== null);
    assert.strictEqual(ownerFetch?.status, 'unlocked');
    assert.strictEqual(ownerFetch?.sealedProse, eval2.tape.sealedProse);
  });

  await test('Auto-evaluation: After telemetry is recorded, sealed tapes with satisfied conditions are automatically evaluated and unlocked without requiring a manual evaluate call', async () => {
    const autoUser = 'user_autoeval_' + Date.now();
    const startTime = 1715000000000;
    const dayMs = 86400000;

    // 1. Seal a tape requiring focusIndex >= 7 for 1 sustained day with 2 min observations
    const tape = await sealTape(autoUser, {
      title: 'Automatic evaluation test tape',
      sealedProse: 'This secret should unlock automatically once telemetry criteria are met.',
      condition: {
        metric: 'focusIndex',
        operator: 'gte',
        threshold: 7,
        sustainedDays: 1,
        minObservations: 2,
        minConfidence: 0.75,
      },
    });
    assert.strictEqual(tape.status, 'sealed');
    assert.strictEqual(tape.sealedProse, undefined);

    // 2. Record first observation at t0
    await recordTelemetryToLedger(autoUser, {
      entryId: 'entry_auto_1',
      recordedAt: startTime,
      stressIndex: 3,
      focusIndex: 8, // qualifying >= 7
      creativityIndex: 6,
      confidenceScore: 0.90,
      dominantThemes: ['focus'],
      modelUsed: 'gemini-3.6-flash',
    });

    // Auto-evaluate immediately: only 1 observation -> tape remains sealed
    const res1 = await autoEvaluateUserSealedTapes(autoUser, startTime);
    assert.strictEqual(res1.unlocked, 0);

    const tapeAfterFirst = await getTapeById(autoUser, tape.tapeId);
    assert.strictEqual(tapeAfterFirst?.status, 'sealed');
    assert.strictEqual(tapeAfterFirst?.sealedProse, undefined);

    // 3. Record second qualifying observation 1.2 days later
    const day2Time = startTime + Math.floor(1.2 * dayMs);
    await recordTelemetryToLedger(autoUser, {
      entryId: 'entry_auto_2',
      recordedAt: day2Time,
      stressIndex: 3,
      focusIndex: 9, // qualifying >= 7
      creativityIndex: 7,
      confidenceScore: 0.92,
      dominantThemes: ['deep work'],
      modelUsed: 'gemini-3.6-flash',
    });

    // Auto-evaluate: condition now satisfied -> automatically unlocked without manual evaluate call!
    const res2 = await autoEvaluateUserSealedTapes(autoUser, day2Time);
    assert.strictEqual(res2.unlocked, 1, 'One tape should have transitioned to unlocked automatically');

    // 4. Verify tape is now unlocked with prose revealed
    const unlockedTape = await getTapeById(autoUser, tape.tapeId);
    assert.strictEqual(unlockedTape?.status, 'unlocked');
    assert.strictEqual(
      unlockedTape?.sealedProse,
      'This secret should unlock automatically once telemetry criteria are met.',
      'Sealed prose must be revealed automatically'
    );
    assert.ok(unlockedTape?.unlockedAt !== null);
    assert.strictEqual(unlockedTape?.unlockEvidence?.satisfied, true);

    // 5. Verify idempotency: running auto-evaluation again on already unlocked tape does nothing
    const res3 = await autoEvaluateUserSealedTapes(autoUser, day2Time + 3600000);
    assert.strictEqual(res3.unlocked, 0, 'Already unlocked tape must not be unlocked again');
    assert.strictEqual(res3.evaluated, 0, 'Already unlocked tapes are skipped');
  });

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTemporalTapeBackendTests().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
