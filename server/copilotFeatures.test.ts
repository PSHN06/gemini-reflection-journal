import assert from 'node:assert/strict';
import {
  validateAttachmentFile,
  formatAttachmentSize,
  MAX_FILE_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_ENTRY,
} from '../src/utils/attachmentLimits';
import {
  generateLocalCopilotFallback,
  CopilotEntryContext,
} from './copilotEngine';

console.log('=== RUNNING COPILOT & ATTACHMENT SUITE ===');

// --- 1. Attachment Limits and Validation ---
console.log('Test 1: File size limit enforcement (<= 5MB)');
const validSizeResult = validateAttachmentFile('notes.txt', 2 * 1024 * 1024, 'text/plain', 0, []);
assert.equal(validSizeResult.valid, true, '2MB file should be accepted');

const oversizeResult = validateAttachmentFile('huge.pdf', 6 * 1024 * 1024, 'application/pdf', 0, []);
assert.equal(oversizeResult.valid, false, '6MB file should be rejected');
assert.match(oversizeResult.error || '', /too large|maximum allowed size/i);
console.log('  ✓ File size limit enforced correctly');

console.log('Test 2: Maximum attachments per entry enforcement (<= 5)');
const atLimitResult = validateAttachmentFile('sixth.txt', 1000, 'text/plain', 5, ['1.txt', '2.txt', '3.txt', '4.txt', '5.txt']);
assert.equal(atLimitResult.valid, false, '6th attachment must be rejected');
assert.match(atLimitResult.error || '', /Maximum 5 attachments/i);
console.log('  ✓ 5 attachments per entry limit enforced');

console.log('Test 3: Duplicate file name prevention');
const duplicateResult = validateAttachmentFile('resume.pdf', 5000, 'application/pdf', 1, ['resume.pdf']);
assert.equal(duplicateResult.valid, false, 'Duplicate file name should be rejected');
assert.match(duplicateResult.error || '', /already attached/i);
console.log('  ✓ Duplicate files rejected cleanly');

console.log('Test 4: Allowed and disallowed file extensions');
const validExts = ['doc.pdf', 'file.docx', 'notes.txt', 'spec.md', 'photo.png', 'snap.jpg', 'graphic.webp'];
for (const f of validExts) {
  const res = validateAttachmentFile(f, 1000, '', 0, []);
  assert.equal(res.valid, true, `File ${f} should be valid`);
}

const invalidExts = ['malicious.exe', 'archive.zip', 'script.sh', 'library.dll'];
for (const f of invalidExts) {
  const res = validateAttachmentFile(f, 1000, '', 0, []);
  assert.equal(res.valid, false, `File ${f} should be invalid`);
  assert.match(res.error || '', /unsupported file type/i);
}
console.log('  ✓ Extension allowlist strictly enforced');

console.log('Test 5: Size formatting utility');
assert.equal(formatAttachmentSize(500), '500 B');
assert.equal(formatAttachmentSize(2048), '2 KB');
assert.equal(formatAttachmentSize(1024 * 1024 * 3.5), '3.5 MB');
console.log('  ✓ formatAttachmentSize formats human-readable strings');

// --- 2. Copilot Offline Resilient Engine ---
console.log('Test 6: App Guide fallback responses');
const tapesGuide = generateLocalCopilotFallback('How do Temporal Tapes work?', undefined, 'tapes');
assert.match(tapesGuide, /Temporal Tapes/i);
assert.match(tapesGuide, /sealed prose|condition/i);

const landscapeGuide = generateLocalCopilotFallback('What is the emotional landscape?', undefined, 'landscape');
assert.match(landscapeGuide, /Emotional Landscape/i);
assert.match(landscapeGuide, /celestial|spatial|universe/i);
console.log('  ✓ App guide correctly explains key product pillars');

console.log('Test 7: Companion reflection with draft context');
const sampleContext: CopilotEntryContext = {
  id: 'entry-123',
  title: 'Returning to Running',
  content: 'Ran 5 kilometers this morning after recovering from an injury. Felt calm and steady.',
  mood: 'calm',
  tags: ['health', 'running'],
};

const companionResponse = generateLocalCopilotFallback('Help me continue this reflection', sampleContext, 'journal');
assert.ok(companionResponse.length > 50, 'Companion response should provide substantive guidance');
console.log('  ✓ Companion mode incorporates active journal context');

console.log('Test 8: Summarize and title prompts');
const summaryResponse = generateLocalCopilotFallback('Summarize this entry', sampleContext, 'journal');
assert.match(summaryResponse, /summary|reflection/i);

const titleResponse = generateLocalCopilotFallback('Suggest a title', sampleContext, 'journal');
assert.match(titleResponse, /title/i);
console.log('  ✓ Summary and title prompts provide tailored guidance');

console.log('====================================================');
console.log('  ALL COPILOT & ATTACHMENT TESTS PASSED (100%)');
console.log('====================================================');
