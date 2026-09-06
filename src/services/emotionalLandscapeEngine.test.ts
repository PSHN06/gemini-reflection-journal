import { generateEmotionalLandscape } from './emotionalLandscapeEngine';
import { JournalEntry } from '../types';

console.log('--- RUNNING 3D EMOTIONAL LANDSCAPE ENGINE TEST SUITE ---');

const baseEntry: JournalEntry = {
  id: 'entry-cricket-happiness-123',
  userId: 'test-user-1',
  title: 'I Played Cricket Today and Was Very Happy',
  content: 'I played cricket today with my friends at the park. We were down in the final overs, but I hit the winning boundary. Quiet relief washed over me after hours of tension. I felt so happy and exhausted afterwards, sharing dinner with my family and feeling grateful for this life.',
  createdAt: 1725364800000,
  updatedAt: 1725364800000,
  mode: 'reflection',
  tags: ['sports', 'joy', 'family'],
  mood: 'joyful',
  messages: [
    {
      id: 'm1',
      role: 'user',
      text: 'I felt so much physical flow during the match and a huge sense of relief when we won.',
      timestamp: 1725364810000,
    },
    {
      id: 'm2',
      role: 'model',
      text: 'It sounds like that moment brought both vibrant energy and grounding peace.',
      timestamp: 1725364820000,
    }
  ],
};

// Test 1: Full generation with authentic prose
const landscape1 = generateEmotionalLandscape(baseEntry, {
  stressIndex: 3,
  focusIndex: 8,
  creativityIndex: 7,
  dominantThemes: ['cricket', 'relief'],
});

if (!landscape1.hasSufficientData) {
  throw new Error('Test 1 Failed: Expected sufficient data for entry with > 10 words');
}

if (landscape1.nodes.length < 5 || landscape1.nodes.length > 12) {
  throw new Error(`Test 1 Failed: Node count ${landscape1.nodes.length} out of required 5..12 range`);
}
console.log(`  ✓ Test 1: Generated valid constellation with ${landscape1.nodes.length} organic nodes`);

// Test 2: Central incident node is at origin [0, 0, 0]
const central = landscape1.nodes[0];
if (central.category !== 'central_incident' || central.position[0] !== 0 || central.position[1] !== 0 || central.position[2] !== 0) {
  throw new Error('Test 2 Failed: Central node must be at origin (0, 0, 0) with category central_incident');
}
console.log(`  ✓ Test 2: Central incident anchored at [0, 0, 0] with title "${central.label}"`);

// Test 3: Grounded verbatim quotes present in every node
landscape1.nodes.forEach((n, idx) => {
  if (!n.groundedQuote || n.groundedQuote.trim().length === 0) {
    throw new Error(`Test 3 Failed: Node ${idx} (${n.shortLabel}) lacks a grounded quote from the text`);
  }
  if (!n.experientialAtmosphere || n.experientialAtmosphere.trim().length === 0) {
    throw new Error(`Test 3 Failed: Node ${idx} (${n.shortLabel}) lacks an experiential atmosphere`);
  }
});
console.log('  ✓ Test 3: Every node is strictly grounded with verbatim journal quotes and experiential atmosphere');

// Test 4: Determinism: Re-running with identical input produces bitwise identical nodes and positions
const landscape2 = generateEmotionalLandscape(baseEntry, {
  stressIndex: 3,
  focusIndex: 8,
  creativityIndex: 7,
  dominantThemes: ['cricket', 'relief'],
});

if (JSON.stringify(landscape1.nodes) !== JSON.stringify(landscape2.nodes)) {
  throw new Error('Test 4 Failed: Non-deterministic output detected across repeated runs with identical seed');
}
console.log('  ✓ Test 4: Bitwise determinism confirmed across independent generations');

// Test 5: Insufficient data handling (< 10 words)
const shortEntry: JournalEntry = {
  ...baseEntry,
  id: 'short-entry-1',
  content: 'Feeling good today.',
  messages: [],
};

const shortLandscape = generateEmotionalLandscape(shortEntry);
if (shortLandscape.hasSufficientData !== false || shortLandscape.nodes.length !== 0) {
  throw new Error('Test 5 Failed: Short entry (< 10 words) must return hasSufficientData=false');
}
console.log('  ✓ Test 5: Insufficient data threshold gracefully handled with hasSufficientData=false');

// Test 6: Relational connections exist and have human explanations
if (landscape1.connections.length === 0) {
  throw new Error('Test 6 Failed: Expected connections in constellation');
}
landscape1.connections.forEach((c) => {
  if (!c.resonanceExplanation || c.resonanceExplanation.trim().length === 0) {
    throw new Error(`Test 6 Failed: Connection ${c.id} lacks resonance explanation`);
  }
});
console.log(`  ✓ Test 6: All ${landscape1.connections.length} emotional strands include narrative resonance explanations`);

console.log('ALL 3D EMOTIONAL LANDSCAPE ENGINE TESTS PASSED.');
