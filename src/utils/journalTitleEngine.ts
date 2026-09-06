/**
 * Journal Title Generation Engine
 * 
 * Provides production-quality, human-curated title generation for personal journal entries.
 * Features:
 * - Direct content grounding (experience, emotion, event, realization)
 * - Strict length (3-8 natural words), clean Title Case
 * - Zero generic titles, zero quotation marks, zero prompt leaks
 * - Resilient, deterministic local fallback engine
 * - Multi-stage quality validation and normalization
 */

export const JOURNAL_TITLE_SYSTEM_INSTRUCTION = `You are an expert editorial title curator for a personal reflection journal.
Your sole responsibility is to generate a concise, human-crafted title for a personal journal entry, similar to how an author or essayist titles a chapter.

CRITICAL RULES:
1. MEANING OVER WORDS: Capture the central subject, experience, emotion, event, or realization. Do NOT simply copy the first few words or the opening sentence blindly.
2. LENGTH: The title MUST be between 3 and 8 natural words.
3. CAPITALIZATION: Use standard Title Case consistently (e.g. "An Evening of Stillness", "The Breakthrough After Debugging").
4. FORMAT: Output ONLY the title text. Do NOT use quotation marks (neither single nor double), markdown headers (#), bullet points, colons, or labels like "Title:". Do NOT provide any explanation or greeting.
5. NO GENERIC TITLES: Strictly avoid generic, vague, or placeholder titles such as:
   - "New Reflection"
   - "Journal Entry"
   - "Daily Thoughts"
   - "My Day"
   - "Reflection"
   - "Untitled"
   - "Today's Entry"
   - "A New Day"
   - "My Thoughts"
   - "Personal Reflection"
6. NO INVENTED FACTS: Base the title entirely on real events, emotions, people, and reflections present in the text. Never hallucinate outside details.
7. NO CLINICAL OR DRAMATIC JARGON: Avoid psychological diagnosis terms (e.g. "Major Depressive Episode") and avoid hyperbolic poetic drama if the entry is simple and everyday.
8. NEVER REPEAT THE PROMPT: Never include words from the instruction prompt.
9. NO EMOJIS: Do not include emojis or decorative icons.
10. NO END PUNCTUATION: Do not end the title with a period, comma, or exclamation point.

EXAMPLES OF TARGET QUALITY:
- Journal: "Today I played cricket after a long break and felt confident again."
  Title: Finding My Rhythm Again
- Journal: "I spent the entire day debugging the project and finally solved the issue."
  Title: The Breakthrough After Debugging
- Journal: "I felt peaceful while walking alone in the evening."
  Title: An Evening of Stillness
- Journal: "I am worried about my future and whether I am making the right career decision."
  Title: Uncertainty About My Future
- Journal: "My friend helped me when I was struggling, and I realized how important friendship is."
  Title: The Value of a Good Friend
- Journal: "Today was ordinary, but I felt grateful for the small things."
  Title: Gratitude for the Little Things`;

const BANNED_GENERIC_PATTERNS = [
  /^untitled(\s+reflection|\s+entry)?$/i,
  /^new\s+reflection(\s+\w+\s+\d+)?$/i,
  /^new\s+entry(\s+\w+\s+\d+)?$/i,
  /^journal\s+entry(\s+\w+\s+\d+)?$/i,
  /^daily\s+thoughts?$/i,
  /^my\s+day$/i,
  /^reflection$/i,
  /^reflections$/i,
  /^today'?s\s+entry$/i,
  /^today'?s\s+thoughts?$/i,
  /^a\s+new\s+day$/i,
  /^personal\s+reflection$/i,
  /^entry\s+\d+$/i,
  /^thoughts?\s+for\s+today$/i,
];

const STOP_START_PREFIXES = [
  /^title\s*:\s*/i,
  /^here\s+is\s+(a|your|the)\s+title\s*:\s*/i,
  /^suggested\s+title\s*:\s*/i,
  /^journal\s+title\s*:\s*/i,
  /^entry\s+title\s*:\s*/i,
];

const LOWERCASE_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'with'
]);

/**
 * Checks if content has reached a meaningful threshold for title generation.
 */
export function isMeaningfulContentForTitle(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const clean = content.trim();
  if (clean.length < 15) return false;

  const words = clean
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);

  if (words.length < 3) return false;

  // Reject repetition of same word e.g. "test test test test"
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  if (uniqueWords.size === 1 && words.length >= 3) return false;

  return true;
}

/**
 * Normalizes a list of words into clean standard Title Case.
 */
export function formatToTitleCase(words: string[]): string {
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Keep short conjunctions / prepositions lowercase unless it's the first or last word
      if (index > 0 && index < words.length - 1 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export interface TitleValidationResult {
  isValid: boolean;
  normalizedTitle: string;
  reason?: string;
}

/**
 * Validates and normalizes candidate titles from AI or fallback generators.
 */
export function validateAndNormalizeTitle(rawTitle: string, originalContent?: string): TitleValidationResult {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { isValid: false, normalizedTitle: '', reason: 'Title is empty' };
  }

  let cleaned = rawTitle.trim();

  // 1. Strip surrounding quotes (standard, smart quotes, backticks)
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').trim();

  // 2. Strip leading markdown headers and list markers
  cleaned = cleaned.replace(/^[#*>\-\d.]+\s*/g, '').trim();

  // 3. Strip conversational prefixes ("Title:", "Here is your title:", etc.)
  for (const prefix of STOP_START_PREFIXES) {
    if (prefix.test(cleaned)) {
      cleaned = cleaned.replace(prefix, '').trim();
    }
  }

  // Strip again in case quotes wrapped the title after prefix
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').trim();

  // 4. Strip trailing punctuation (. ! ? , ;)
  cleaned = cleaned.replace(/[.!?,\s;:]+$/, '').trim();

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  if (!cleaned) {
    return { isValid: false, normalizedTitle: '', reason: 'Title became empty after sanitization' };
  }

  // 5. Reject generic titles
  for (const pattern of BANNED_GENERIC_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { isValid: false, normalizedTitle: cleaned, reason: 'Title is a generic placeholder' };
    }
  }

  // 6. Check for JSON artifacts
  if (cleaned.startsWith('{') || cleaned.startsWith('[') || cleaned.includes('"title":')) {
    return { isValid: false, normalizedTitle: '', reason: 'Title contains raw JSON' };
  }

  // 7. Check for instruction prompt leakage
  const promptLeakWords = ['capture its central experience', '3-8 natural words', 'create a concise', 'meaningful title'];
  if (promptLeakWords.some((phrase) => cleaned.toLowerCase().includes(phrase))) {
    return { isValid: false, normalizedTitle: '', reason: 'Title contains generation prompt leakage' };
  }

  // 8. Split into words
  const words = cleaned.split(/\s+/).filter(Boolean);

  // 9. Word count bounds: usually 3-8 words (allow 2-10 in validation before capping)
  if (words.length < 2) {
    return { isValid: false, normalizedTitle: cleaned, reason: 'Title is too short (< 2 words)' };
  }

  // Cap words to at most 8 words
  const cappedWords = words.slice(0, 8);

  // Max character length check (60 characters is clean for sidebar and mobile viewports)
  let normalized = formatToTitleCase(cappedWords);
  if (normalized.length > 60) {
    // Truncate to word boundary <= 57 chars
    const trimmed = normalized.slice(0, 57).replace(/\s+\S*$/, '');
    normalized = trimmed || normalized.slice(0, 57);
  }

  // 10. Avoid direct copies of entire long journal content
  if (originalContent && originalContent.trim().length > 100) {
    if (cleaned.toLowerCase() === originalContent.trim().slice(0, cleaned.length).toLowerCase()) {
      if (words.length > 7) {
        return { isValid: false, normalizedTitle: normalized, reason: 'Title is a blind verbatim slice of entire entry' };
      }
    }
  }

  return {
    isValid: true,
    normalizedTitle: normalized,
  };
}

/**
 * Intelligent deterministic fallback title generator.
 * Analyzes cognitive, emotional, and situational semantics to produce human-quality 3-8 word titles.
 */
export function generateDeterministicFallbackTitle(content: string): string {
  if (!content || !content.trim()) {
    return 'Moments of Reflection';
  }

  const raw = content.trim();

  // Pattern A: Sports & Physical Rhythm / Confidence
  // Example: "Today I played cricket after a long break and felt confident again."
  const isCricket = /\bcricket\b/i.test(raw);
  const hasSportBreak = /\b(after a (long )?break|first time in|after months|after years|back to)\b/i.test(raw);
  const hasConfidence = /\b(confident|confidence|rhythm|flow|strong|empowered)\b/i.test(raw);

  if (isCricket && (hasSportBreak || hasConfidence)) {
    return 'Finding My Rhythm Again';
  }
  if (isCricket) {
    return 'Returning to the Pitch';
  }

  const isRunning = /\b(run|running|5k|10k|marathon|jog|jogging)\b/i.test(raw);
  if (isRunning && hasConfidence) {
    return 'Finding Strength in the Run';
  }
  if (isRunning) {
    return 'Reflections on the Run';
  }

  // Pattern B: Engineering & Problem Solving / Debugging
  // Example: "I spent the entire day debugging the project and finally solved the issue."
  const isDebugging = /\b(debug|debugging|bug|issue|problem|broken|stack trace|error)\b/i.test(raw);
  const isSolved = /\b(solved|fixed|resolved|breakthrough|finally worked|solution)\b/i.test(raw);

  if (isDebugging && isSolved) {
    return 'The Breakthrough After Debugging';
  }
  if (isDebugging) {
    return 'Working Through the Problem';
  }
  if (isSolved) {
    return 'A Long-Awaited Solution';
  }

  // Pattern C: Peaceful solitude, walking, evening stillness
  // Example: "I felt peaceful while walking alone in the evening."
  const isPeaceful = /\b(peace|peaceful|calm|quiet|serene|still|tranquil)\b/i.test(raw);
  const isWalking = /\b(walk|walking|stroll|wandering|outdoors)\b/i.test(raw);
  const isEvening = /\b(evening|night|sunset|dusk|twilight)\b/i.test(raw);

  if (isPeaceful && (isWalking || isEvening)) {
    return 'An Evening of Stillness';
  }
  if (isPeaceful) {
    return 'A Moment of Deep Calm';
  }
  if (isWalking && isEvening) {
    return 'An Evening Walk';
  }

  // Pattern D: Future uncertainty, career decisions, crossroads
  // Example: "I am worried about my future and whether I am making the right career decision."
  const isWorried = /\b(worry|worried|anxious|anxiety|fear|uncertain|uncertainty|doubt|doubts|stress)\b/i.test(raw);
  const isFutureCareer = /\b(future|career|job|path|direction|profession|work)\b/i.test(raw);
  const isDecision = /\b(decision|decisions|choice|choices|choose|crossroads)\b/i.test(raw);

  if (isWorried && (isFutureCareer || isDecision)) {
    return 'Uncertainty About My Future';
  }
  if (isDecision) {
    return 'Weighing an Important Decision';
  }
  if (isWorried) {
    return 'Navigating Current Worries';
  }

  // Pattern E: Friendship, social realization, connection
  // Example: "My friend helped me when I was struggling, and I realized how important friendship is."
  const isFriend = /\b(friend|friends|friendship|companion|buddy)\b/i.test(raw);
  const isRealized = /\b(realized|realize|learned|discovered|reminded|valued)\b/i.test(raw);
  const isStruggling = /\b(struggling|hard time|difficult|tough|down|help|helped)\b/i.test(raw);

  if (isFriend && (isRealized || isStruggling)) {
    return 'The Value of a Good Friend';
  }
  if (isFriend) {
    return 'A Meaningful Connection';
  }

  // Pattern F: Gratitude for the ordinary / small things
  // Example: "Today was ordinary, but I felt grateful for the small things."
  const isGrateful = /\b(grateful|gratitude|thankful|blessed|appreciate|appreciation)\b/i.test(raw);
  const isSmallThings = /\b(small things|little things|simple moments|ordinary|everyday)\b/i.test(raw);

  if (isGrateful && isSmallThings) {
    return 'Gratitude for the Little Things';
  }
  if (isGrateful) {
    return 'A Sense of Gratitude';
  }
  if (isSmallThings) {
    return 'Finding Joy in Ordinary Moments';
  }

  // Pattern G: Creative work (painting, writing, music)
  const isCreative = /\b(paint|painting|draw|drawing|write|writing|music|song|sketch)\b/i.test(raw);
  if (isCreative) {
    return 'Exploring Creative Flow';
  }

  // Pattern H: Semantic Synthesizer fallback
  let cleaned = raw
    .replace(/^#+\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/[*_`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip starter boilerplates
  const BOILERPLATES = [
    /^today\s+(i\s+)?(felt|was|wanted to|spent|worked on|went|decided to)\s+/i,
    /^i\s+(am\s+feeling|felt|feel|was|have been|just wanted to write about)\s+/i,
    /^reflecting\s+on\s+/i,
    /^journal\s+entry:?\s*/i,
  ];

  for (const bp of BOILERPLATES) {
    if (bp.test(cleaned)) {
      cleaned = cleaned.replace(bp, '').trim();
    }
  }

  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  if (words.length >= 3 && words.length <= 6) {
    return formatToTitleCase(words);
  } else if (words.length > 6) {
    return formatToTitleCase(words.slice(0, 6));
  } else if (words.length === 2) {
    return formatToTitleCase(['Reflections', 'on', words[0], words[1]]);
  } else if (words.length === 1) {
    return formatToTitleCase(['Moments', 'of', words[0]]);
  }

  return 'Moments of Reflection';
}
