/**
 * Utilities for journal entry formatting, deterministic title generation,
 * and date/time presentation.
 */

const STOP_PREFIXES = [
  /^i need to make an important decision regarding:?\s*/i,
  /^today went well because:?\s*/i,
  /^one key lesson or insight i want to hold onto is:?\s*/i,
  /^i am feeling stuck on:?\s*/i,
  /^here is what is blocking my momentum:?\s*/i,
  /^three specific moments or insights i am deeply grateful for today are:?\s*/i,
  /^i want to reflect on:?\s*/i,
  /^i am reflecting on:?\s*/i,
  /^i just wanted to write about:?\s*/i,
  /^today i wanted to talk about:?\s*/i,
  /^journal entry:?\s*/i,
  /^reflection on:?\s*/i,
  /^today i\s+/i,
  /^i felt\s+/i,
  /^i feel\s+/i,
  /^i was\s+/i,
  /^i am\s+/i,
];

const LOWERCASE_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'with'
]);

import {
  isMeaningfulContentForTitle,
  generateDeterministicFallbackTitle,
  validateAndNormalizeTitle,
  formatToTitleCase,
} from './journalTitleEngine';

export {
  isMeaningfulContentForTitle,
  generateDeterministicFallbackTitle,
  validateAndNormalizeTitle,
};

/**
 * Checks whether a given title is a system default or placeholder title.
 */
export function isDefaultTitle(title?: string | null): boolean {
  if (!title || !title.trim()) return true;
  const t = title.trim().toLowerCase();
  return (
    t === 'untitled' ||
    t === 'untitled entry' ||
    t === 'untitled reflection' ||
    t === 'journal entry' ||
    t === 'daily thoughts' ||
    t === 'daily thought' ||
    t === 'my day' ||
    t === 'reflection' ||
    t === 'reflections' ||
    t === 'personal reflection' ||
    t === "today's entry" ||
    t === 'today entry' ||
    t === 'a new day' ||
    t.startsWith('new reflection') ||
    t.startsWith('new entry') ||
    t.startsWith('untitled') ||
    t.startsWith('personal reflection')
  );
}

/**
 * Formats a string to Title Case while keeping standard conjunctions lowercase
 * unless they are the first word.
 */
export function toTitleCase(words: string[]): string {
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Deterministically generates a relevant 3 to 8 word title from journal text.
 */
export function generateTitleFromContent(rawText: string): string {
  if (!rawText || !rawText.trim()) {
    return 'Reflection ' + formatJournalDate(Date.now());
  }

  // 1. Clean markdown headers, quotes, asterisks, bullet points
  let cleaned = rawText
    .replace(/^#+\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/[*_`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Remove common journaling sentence starter boilerplate
  for (const prefix of STOP_PREFIXES) {
    if (prefix.test(cleaned)) {
      cleaned = cleaned.replace(prefix, '').trim();
    }
  }

  // If text became empty after stripping prefix, fall back to the first non-empty segment of rawText
  if (!cleaned) {
    cleaned = rawText.replace(/[*_`~#]/g, '').trim();
  }

  // 3. Take first sentence or up to first newline/punctuation boundary
  const sentenceMatch = cleaned.match(/^([^.!?\n]+)/);
  const coreSentence = sentenceMatch ? sentenceMatch[1].trim() : cleaned;

  // 4. Split into words and filter out pure punctuation
  const words = coreSentence
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  if (words.length === 0) {
    return 'Reflection ' + formatJournalDate(Date.now());
  }

  // 5. Constrain length to 3-8 words
  let selectedWords: string[];
  if (words.length < 3) {
    // If only 1-2 words, add descriptive context
    if (words.length === 1) {
      selectedWords = ['Reflection', 'on', words[0]];
    } else {
      selectedWords = ['Thoughts', 'on', words[0], words[1]];
    }
  } else if (words.length > 8) {
    selectedWords = words.slice(0, 8);
  } else {
    selectedWords = words;
  }

  // 6. Return Title Cased string
  return toTitleCase(selectedWords);
}

/**
 * Formats a timestamp into standard local date & time:
 * e.g., "Sep 3, 2026 · 8:04 PM"
 */
export function formatJournalDateTime(timestamp?: number | null): string {
  if (!timestamp || isNaN(timestamp)) return '—';
  const date = new Date(timestamp);
  
  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart} · ${timePart}`;
}

/**
 * Formats a timestamp into standard local date:
 * e.g., "Sep 3, 2026"
 */
export function formatJournalDate(timestamp?: number | null): string {
  if (!timestamp || isNaN(timestamp)) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a timestamp into standard local time:
 * e.g., "8:04 PM"
 */
export function formatJournalTime(timestamp?: number | null): string {
  if (!timestamp || isNaN(timestamp)) return '—';
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Formats for sidebar list:
 * Today -> "8:04 PM"
 * Same year -> "Sep 3"
 * Different year -> "Sep 3, 2025"
 */
export function formatSidebarDate(timestamp?: number | null): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
