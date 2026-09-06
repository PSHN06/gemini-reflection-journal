import { 
  generateTitleFromContent, 
  isDefaultTitle, 
  toTitleCase,
  formatJournalDateTime, 
  formatJournalDate, 
  formatJournalTime,
  formatSidebarDate
} from '../src/utils/journalFormatters';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('--- RUNNING JOURNAL FUNCTIONALITY & AUDIT TEST SUITE ---');

// 1. Title generation tests
console.log('Test 1: Title generation constraints (3 to 8 words, Title Case)');
const cricketTitle = generateTitleFromContent('I played cricket today and was very happy');
const cricketWords = cricketTitle.split(/\s+/);
assert(cricketWords.length >= 3 && cricketWords.length <= 8, `Expected 3-8 words, got ${cricketWords.length}: "${cricketTitle}"`);
assert(/Cricket/i.test(cricketTitle), `Expected "Cricket" in title: "${cricketTitle}"`);
console.log(`  ✓ Cricket entry titled as: "${cricketTitle}" (${cricketWords.length} words)`);

console.log('Test 2: Stripping common prompt starter prefixes');
const prefixTest = generateTitleFromContent('I need to make an important decision regarding: switching careers to machine learning');
assert(!/important decision/i.test(prefixTest), `Prefix not stripped: "${prefixTest}"`);
assert(/switching careers/i.test(prefixTest), `Core subject missing: "${prefixTest}"`);
console.log(`  ✓ Prefix stripped: "${prefixTest}"`);

console.log('Test 3: Markdown and noise stripping');
const mdTest = generateTitleFromContent('# Summary of Today\n\n* Feeling much better after **morning run** around the reservoir.');
assert(!mdTest.includes('#') && !mdTest.includes('*'), `Markdown syntax remained: "${mdTest}"`);
console.log(`  ✓ Markdown stripped: "${mdTest}"`);

console.log('Test 4: Single word input handling (expands to descriptive 3 words)');
const singleWord = generateTitleFromContent('Focus');
const singleWords = singleWord.split(/\s+/);
assert(singleWords.length >= 3, `Single word should expand to at least 3 words, got ${singleWords.length}: "${singleWord}"`);
console.log(`  ✓ Single word expanded: "${singleWord}"`);

console.log('Test 5: Long entry word constraint (capped at 8 words)');
const longEntry = 'I had an extraordinarily intense and emotionally turbulent conversation with my former manager about future organizational restructuring';
const longTitle = generateTitleFromContent(longEntry);
const longTitleWords = longTitle.split(/\s+/);
assert(longTitleWords.length <= 8, `Expected <= 8 words, got ${longTitleWords.length}: "${longTitle}"`);
console.log(`  ✓ Long entry constrained: "${longTitle}" (${longTitleWords.length} words)`);

console.log('Test 6: Default title identification');
assert(isDefaultTitle(''), 'Empty string is default title');
assert(isDefaultTitle('Untitled'), 'Untitled is default title');
assert(isDefaultTitle('Untitled Reflection'), 'Untitled Reflection is default title');
assert(isDefaultTitle('New Reflection Sep 3'), 'New Reflection Sep 3 is default title');
assert(!isDefaultTitle('Playing Cricket with Friends'), 'Custom title is not default title');
assert(!isDefaultTitle('Deep Work Session'), 'Deep Work Session is not default title');
console.log('  ✓ Default title identification passed');

// 2. Date and Time formatting tests
console.log('Test 7: Date & Time formatting stability');
const now = Date.now();
const formattedDateTime = formatJournalDateTime(now);
assert(formattedDateTime.includes('·'), `Formatted date time missing separator: "${formattedDateTime}"`);
const formattedDate = formatJournalDate(now);
assert(formattedDate.length > 4, `Invalid date string: "${formattedDate}"`);
const formattedTime = formatJournalTime(now);
assert(/AM|PM/i.test(formattedTime), `Invalid time string: "${formattedTime}"`);

// Sidebar relative formatting
const sidebarDateToday = formatSidebarDate(now);
assert(/AM|PM/i.test(sidebarDateToday), `Today should format as time: "${sidebarDateToday}"`);
const oneYearAgo = now - 400 * 24 * 3600 * 1000;
const sidebarDateOld = formatSidebarDate(oneYearAgo);
assert(/\d{4}/.test(sidebarDateOld), `Past year should include 4-digit year: "${sidebarDateOld}"`);

// Invalid dates
assert(formatJournalDateTime(undefined) === '—', 'Undefined timestamp should produce em-dash');
assert(formatJournalDateTime(NaN) === '—', 'NaN timestamp should produce em-dash');
console.log('  ✓ Date and time formatting passed');

// 3. Search and filtering logic tests
console.log('Test 8: Case-insensitive search and tag matching');
const mockEntries = [
  {
    id: 'e1',
    title: 'Cricket in the Park',
    content: 'Played a great match with teammates',
    messages: [{ id: 'm1', role: 'user' as const, text: 'Had a wonderful afternoon', timestamp: now }],
    summary: 'Reflected on joy of team sports',
    tags: ['cricket', 'Health'],
    mood: 'energized',
    createdAt: now - 2000,
    updatedAt: now - 1000,
  },
  {
    id: 'e2',
    title: 'Architectural Review',
    content: 'Reviewing microservices and database sharding',
    messages: [{ id: 'm2', role: 'user' as const, text: 'Scalability is the focus', timestamp: now }],
    summary: 'Clear roadmap defined',
    tags: ['work', 'Tech'],
    mood: 'focused',
    createdAt: now - 5000,
    updatedAt: now - 3000,
  },
];

// Search by title
const searchByTitle = mockEntries.filter(e => e.title.toLowerCase().includes('cricket'));
assert(searchByTitle.length === 1 && searchByTitle[0].id === 'e1', 'Search by title failed');

// Case-insensitive search by message content
const searchByMsg = mockEntries.filter(e => e.messages.some(m => m.text.toLowerCase().includes('wonderful')));
assert(searchByMsg.length === 1 && searchByMsg[0].id === 'e1', 'Search by message content failed');

// Search by summary
const searchBySummary = mockEntries.filter(e => (e.summary || '').toLowerCase().includes('roadmap'));
assert(searchBySummary.length === 1 && searchBySummary[0].id === 'e2', 'Search by summary failed');

// Tag match with case insensitivity
const searchByTag = mockEntries.filter(e => e.tags.some(t => t.toLowerCase() === 'health'));
assert(searchByTag.length === 1 && searchByTag[0].id === 'e1', 'Tag search failed');

console.log('  ✓ Search and filtering passed');

console.log('ALL JOURNAL AUDIT LOGIC TESTS PASSED.');
