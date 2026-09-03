import { TapeUnlockCondition, UnlockEvidence } from '../types';

/**
 * Returns a human-friendly label for a cognitive metric.
 */
export function formatMetricName(metric: string): string {
  switch (metric) {
    case 'stressIndex':
      return 'Stress Level';
    case 'focusIndex':
      return 'Focus';
    case 'creativityIndex':
      return 'Creativity';
    default:
      return metric;
  }
}

/**
 * Returns a human-friendly description of an unlock condition.
 * Example: "Stress Level ≤ 4 sustained across 7 days (min. 5 observations)"
 */
export function formatConditionSummary(condition: TapeUnlockCondition): string {
  const metric = formatMetricName(condition.metric);
  const operatorSymbol = condition.operator === 'lte' ? '≤' : '≥';
  const targetDesc = `${metric} ${operatorSymbol} ${condition.threshold}/10`;
  
  const daysText = condition.sustainedDays === 0
    ? 'immediate verification'
    : `${condition.sustainedDays} sustained ${condition.sustainedDays === 1 ? 'day' : 'days'}`;
    
  const obsText = `${condition.minObservations} ${condition.minObservations === 1 ? 'entry' : 'entries'}`;

  return `${targetDesc} across ${daysText} (min. ${obsText})`;
}

/**
 * Returns a human-friendly explanation for an unlock evidence block.
 */
export function formatUnlockEvidenceExplanation(evidence?: UnlockEvidence | null): string {
  if (!evidence) {
    return 'Unlocked when journal-derived signals satisfied your condition.';
  }
  
  const days = evidence.currentStreakDays;
  const count = evidence.observationCount;
  return `Unlocked after ${days} ${days === 1 ? 'day' : 'days'} of qualifying observations across ${count} journal ${count === 1 ? 'entry' : 'entries'}.`;
}

/**
 * Formats timestamps into calm, readable date strings.
 */
export function formatTapeDate(timestamp?: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats timestamps with time for detail view.
 */
export function formatTapeDateTime(timestamp?: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
