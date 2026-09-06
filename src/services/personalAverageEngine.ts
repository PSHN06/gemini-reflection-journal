import { JournalEntry, TelemetryMetrics } from '../types';
import {
  EmotionalLandscapeData,
  LandscapeNode,
  LandscapeConnection,
  OuterFormType,
  SurfaceBehaviorType,
  MaterialType,
  EmotionalColorSpec,
} from '../types/landscape';
import {
  EXPERIENTIAL_ARCHETYPES,
  SentimentExtract,
  hashString,
  createSeededRandom,
  splitIntoSentences,
  formatGroundedQuote,
} from './emotionalLandscapeEngine';
import { formatJournalDate } from '../utils/journalFormatters';
import { buildSpaciousSolarLayout, RawNodeCandidate } from './spatialSolarLayout';

export type PatternTimePeriod = 'daily' | 'weekly' | 'monthly';

export interface PeriodRange {
  period: PatternTimePeriod;
  referenceDate: Date;
  startDate: Date;
  endDate: Date;
  periodLabel: string;
  periodDateRange: string;
  hasFutureBound: boolean;
}

/**
 * Calculates start, end, and presentation labels for Daily, Weekly, and Monthly periods.
 */
export function calculatePeriodRange(
  period: PatternTimePeriod,
  referenceDate: Date = new Date()
): PeriodRange {
  const d = new Date(referenceDate);
  const now = new Date();

  if (period === 'daily') {
    const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const isToday = startDate.toDateString() === now.toDateString();
    const isYesterday =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() ===
      startDate.toDateString();

    const periodLabel = isToday
      ? 'Today'
      : isYesterday
      ? 'Yesterday'
      : formatJournalDate(startDate.getTime());

    const periodDateRange = startDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const hasFutureBound = endDate.getTime() >= now.getTime();

    return {
      period,
      referenceDate: d,
      startDate,
      endDate,
      periodLabel,
      periodDateRange,
      hasFutureBound,
    };
  }

  if (period === 'weekly') {
    // Week starting Monday (or Sunday)
    const day = d.getDay(); // 0 is Sunday
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const isThisWeek = monday.getTime() <= now.getTime() && sunday.getTime() >= now.getTime();

    const startStr = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = sunday.toLocaleDateString(undefined, {
      month: monday.getMonth() === sunday.getMonth() ? undefined : 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const periodLabel = isThisWeek ? 'This Week' : `Week of ${startStr}`;
    const periodDateRange = `${startStr} – ${endStr}`;
    const hasFutureBound = sunday.getTime() >= now.getTime();

    return {
      period,
      referenceDate: d,
      startDate: monday,
      endDate: sunday,
      periodLabel,
      periodDateRange,
      hasFutureBound,
    };
  }

  // Monthly
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  const isThisMonth =
    firstDay.getFullYear() === now.getFullYear() && firstDay.getMonth() === now.getMonth();

  const monthName = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const periodLabel = isThisMonth ? 'This Month' : monthName;
  const periodDateRange = monthName;
  const hasFutureBound = lastDay.getTime() >= now.getTime();

  return {
    period,
    referenceDate: d,
    startDate: firstDay,
    endDate: lastDay,
    periodLabel,
    periodDateRange,
    hasFutureBound,
  };
}

/**
 * Shifts the reference date by -1 or +1 step (Day, Week, or Month).
 */
export function shiftPeriod(
  period: PatternTimePeriod,
  referenceDate: Date,
  direction: -1 | 1
): Date {
  const next = new Date(referenceDate);
  if (period === 'daily') {
    next.setDate(next.getDate() + direction);
  } else if (period === 'weekly') {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setMonth(next.getMonth() + direction);
  }
  return next;
}

interface ConceptOccurrence {
  arch: SentimentExtract;
  entryCount: number;
  totalOccurrences: number;
  entryIds: Set<string>;
  coOccurredWith: Map<string, number>;
  representativeQuotes: {
    quote: string;
    entryTitle: string;
    dateStr: string;
    entryId: string;
  }[];
  intensities: number[];
  weights: number[];
  calmnessValues: number[];
  instabilities: number[];
  opennessValues: number[];
  complexities: number[];
  conflicts: number[];
}

/**
 * Generates the Personal Average Map (Aggregate Emotional Landscape)
 * across multiple journal entries for the specified time period.
 */
export function generatePersonalAverageLandscape(
  allEntries: JournalEntry[],
  periodRange: PeriodRange,
  telemetry?: TelemetryMetrics | null
): EmotionalLandscapeData {
  const { period, startDate, endDate, periodLabel, periodDateRange } = periodRange;

  // 1. Filter entries within the period boundaries
  const periodEntries = allEntries.filter((entry) => {
    const time = entry.updatedAt || entry.createdAt;
    return time >= startDate.getTime() && time <= endDate.getTime();
  });

  // Calculate total word count in period
  const totalWordCount = periodEntries.reduce((acc, entry) => {
    const text = (entry.content || '') + ' ' + (entry.messages || []).map((m) => m.text).join(' ');
    const count = text.trim().split(/\s+/).filter(Boolean).length;
    return acc + count;
  }, 0);

  // Empty state: No entries in period
  if (periodEntries.length === 0) {
    return {
      entryId: `aggregate-${period}-${startDate.getTime()}`,
      entryTitle: periodLabel,
      centralIncidentSummary: `No reflections found for ${periodLabel}.`,
      hasSufficientData: false,
      wordCount: 0,
      nodes: [],
      connections: [],
      mode: 'patterns',
      timePeriod: period,
      periodLabel,
      periodDateRange,
      entryCountInPeriod: 0,
      emptyReason: 'no_entries_in_period',
      globalAtmosphere: {
        dominantFeel: 'Silent & Unwritten',
        temperature: 'neutral_still',
        ambientLightColor: '#121216',
        fogColor: '#0a0a0c',
        fogDensity: 0.04,
      },
      telemetryModulation: {
        stressDampening: 0.5,
        focusClarity: 0.5,
        creativityBranching: 0.5,
      },
    };
  }

  // 2. Extract concepts grounded in authentic journal text across each entry
  const conceptMap = new Map<string, ConceptOccurrence>();

  periodEntries.forEach((entry) => {
    const userTexts: string[] = [];
    if (entry.content?.trim()) userTexts.push(entry.content.trim());
    (entry.messages || []).forEach((m) => {
      if (m.role === 'user' && m.text?.trim()) userTexts.push(m.text.trim());
    });

    const combinedText = userTexts.join(' ');
    if (combinedText.length < 20) return;

    const lowerText = combinedText.toLowerCase();
    const sentences = splitIntoSentences(combinedText);
    const entryDateStr = formatJournalDate(entry.updatedAt || entry.createdAt);
    const entryTitle = entry.title || 'Untitled Reflection';

    const matchedInThisEntry: string[] = [];

    EXPERIENTIAL_ARCHETYPES.forEach((arch) => {
      const hasKeyword = lowerText.includes(arch.keyword);
      const hasSynonym = arch.synonyms.some((syn) => lowerText.includes(syn));

      if (hasKeyword || hasSynonym) {
        matchedInThisEntry.push(arch.shortLabel);

        // Find best representative sentence in this entry
        let bestSentence = '';
        for (const s of sentences) {
          const sLower = s.toLowerCase();
          if (sLower.includes(arch.keyword) || arch.synonyms.some((syn) => sLower.includes(syn))) {
            bestSentence = s;
            break;
          }
        }
        if (!bestSentence && sentences.length > 0) {
          bestSentence = sentences[0];
        }

        const quote = formatGroundedQuote(bestSentence || combinedText.slice(0, 80));

        let occ = conceptMap.get(arch.shortLabel);
        if (!occ) {
          occ = {
            arch,
            entryCount: 0,
            totalOccurrences: 0,
            entryIds: new Set<string>(),
            coOccurredWith: new Map<string, number>(),
            representativeQuotes: [],
            intensities: [],
            weights: [],
            calmnessValues: [],
            instabilities: [],
            opennessValues: [],
            complexities: [],
            conflicts: [],
          };
          conceptMap.set(arch.shortLabel, occ);
        }

        if (!occ.entryIds.has(entry.id)) {
          occ.entryIds.add(entry.id);
          occ.entryCount += 1;
        }
        occ.totalOccurrences += 1;

        if (quote && occ.representativeQuotes.length < 3) {
          occ.representativeQuotes.push({
            quote,
            entryTitle,
            dateStr: entryDateStr,
            entryId: entry.id,
          });
        }

        occ.intensities.push(arch.intensityBase);
        occ.weights.push(arch.weightBase);
        occ.calmnessValues.push(arch.calmnessBase);
        occ.instabilities.push(arch.instabilityBase);
        occ.opennessValues.push(arch.opennessBase);
        occ.complexities.push(arch.complexityBase);
        occ.conflicts.push(arch.conflictBase);
      }
    });

    // Track co-occurrences between matched concepts in the same entry
    for (let i = 0; i < matchedInThisEntry.length; i++) {
      for (let j = 0; j < matchedInThisEntry.length; j++) {
        if (i !== j) {
          const nameA = matchedInThisEntry[i];
          const nameB = matchedInThisEntry[j];
          const occA = conceptMap.get(nameA);
          if (occA) {
            occA.coOccurredWith.set(nameB, (occA.coOccurredWith.get(nameB) || 0) + 1);
          }
        }
      }
    }
  });

  const distinctConcepts = Array.from(conceptMap.values());

  // Graceful empty state when insufficient recurring patterns are detected
  if (distinctConcepts.length < 2) {
    return {
      entryId: `aggregate-${period}-${startDate.getTime()}`,
      entryTitle: periodLabel,
      centralIncidentSummary: `Not enough journal patterns yet. More reflections are needed before meaningful recurring patterns can be shown.`,
      hasSufficientData: false,
      wordCount: totalWordCount,
      nodes: [],
      connections: [],
      mode: 'patterns',
      timePeriod: period,
      periodLabel,
      periodDateRange,
      entryCountInPeriod: periodEntries.length,
      emptyReason: 'insufficient_patterns',
      globalAtmosphere: {
        dominantFeel: 'Fledgling Patterns',
        temperature: 'neutral_still',
        ambientLightColor: '#121216',
        fogColor: '#0a0a0c',
        fogDensity: 0.04,
      },
      telemetryModulation: {
        stressDampening: 0.5,
        focusClarity: 0.5,
        creativityBranching: 0.5,
      },
    };
  }

  // 3. Dynamic Node Budget based on actual writing depth and entries in period
  // Section 6 guidelines:
  // - very little data: 2–4 nodes
  // - moderate data: 5–9 nodes
  // - rich data: 10–15 nodes
  let maxSatelliteBudget: number;
  if (periodEntries.length <= 1 || totalWordCount < 120) {
    maxSatelliteBudget = Math.min(4, Math.max(2, distinctConcepts.length));
  } else if (periodEntries.length <= 4 || totalWordCount < 450) {
    maxSatelliteBudget = Math.min(8, Math.max(4, Math.floor(distinctConcepts.length * 0.9)));
  } else {
    maxSatelliteBudget = Math.min(14, Math.max(6, distinctConcepts.length));
  }

  // 4. Rank concepts by relative frequency and importance
  const totalEntriesInPeriod = periodEntries.length;
  const maxOccurrences = Math.max(...distinctConcepts.map((c) => c.totalOccurrences), 1);

  interface ScoredConcept {
    occ: ConceptOccurrence;
    importance: number;
    frequencyPercent: number;
  }

  const scoredConcepts: ScoredConcept[] = distinctConcepts.map((occ) => {
    const entryRatio = occ.entryCount / totalEntriesInPeriod;
    const occRatio = occ.totalOccurrences / maxOccurrences;
    const importance = entryRatio * 0.65 + occRatio * 0.35;
    const frequencyPercent = Math.round(entryRatio * 100);
    return { occ, importance, frequencyPercent };
  });

  scoredConcepts.sort((a, b) => b.importance - a.importance);
  const selectedConcepts = scoredConcepts.slice(0, maxSatelliteBudget);

  // 5. Seeded deterministic layout generator
  const layoutSeed = hashString(
    `aggregate::${period}::${startDate.getTime()}::${selectedConcepts.map((s) => s.occ.arch.shortLabel).join('|')}`
  );
  const rand = createSeededRandom(layoutSeed);

  // Telemetry modulation for presentation dynamics
  const stressIndex = telemetry?.stressIndex ?? 4;
  const focusIndex = telemetry?.focusIndex ?? 6;
  const creativityIndex = telemetry?.creativityIndex ?? 6;

  const stressMod = (stressIndex - 5) / 10;
  const focusMod = (focusIndex - 5) / 10;
  const creativityMod = (creativityIndex - 5) / 10;

  // 6. Central Anchor Node (represents the aggregated time period)
  let centralPeriodTitle = periodLabel;
  if (period === 'daily') {
    centralPeriodTitle = periodLabel === 'Today' ? 'Today' : periodLabel;
  } else if (period === 'weekly') {
    centralPeriodTitle = periodLabel;
  } else {
    centralPeriodTitle = periodLabel;
  }

  const centralNode: LandscapeNode = {
    id: 'node-aggregate-central',
    label: centralPeriodTitle,
    shortLabel: period === 'daily' ? 'Daily Pattern' : period === 'weekly' ? 'Weekly Pattern' : 'Monthly Pattern',
    category: 'central_incident',
    groundedQuote: `Aggregate emotional & cognitive patterns across ${totalEntriesInPeriod} reflection${totalEntriesInPeriod > 1 ? 's' : ''}`,
    experientialAtmosphere: `Recurring emotional and cognitive currents distilled across ${totalEntriesInPeriod} reflections written during ${periodDateRange}`,
    narrativeSignificance: `The temporal core anchoring recurring themes for ${periodLabel}`,
    intensity: 0.88,
    weight: Math.min(1.0, Math.max(0.2, 0.5 + stressMod)),
    calmness: Math.min(1.0, Math.max(0.1, 0.65 - stressMod * 0.4)),
    instability: Math.min(1.0, Math.max(0.1, 0.22 + stressMod * 0.3)),
    openness: Math.min(1.0, Math.max(0.2, 0.75 + creativityMod * 0.25)),
    emotionalDistance: 0.0,
    complexity: Math.min(1.0, Math.max(0.3, 0.7 + creativityMod * 0.3)),
    conflict: Math.min(1.0, Math.max(0.0, 0.2 + stressMod * 0.35)),
    narrativeImportance: 1.0,
    outerForm: 'rounded_open',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    colorSpec: {
      baseColor: '#6c4620', // warm bronze champagne amber
      innerGlowColor: '#a86f2a', // golden amber wisp
      rimColor: '#f7ebd5', // delicate ivory rim
      attenuationColor: '#140b03', // dark smoked bronze shadow
      roughness: 0.25,
      metalness: 0.03,
      transmission: 0.66,
      opacity: 0.86,
    },
    position: [0, 0, 0],
    baseRadius: 3.6,
  };

  // 7. Spatial Layout for Recurring Concepts with 3D Solar System Layout
  const rawSatellites: RawNodeCandidate[] = selectedConcepts.map((sc, i) => {
    const { occ, importance, frequencyPercent } = sc;
    const { arch } = occ;

    const avgIntensity = occ.intensities.reduce((a, b) => a + b, 0) / occ.intensities.length;
    const avgWeight = occ.weights.reduce((a, b) => a + b, 0) / occ.weights.length;
    const avgCalmness = occ.calmnessValues.reduce((a, b) => a + b, 0) / occ.calmnessValues.length;
    const avgInstability = occ.instabilities.reduce((a, b) => a + b, 0) / occ.instabilities.length;
    const avgOpenness = occ.opennessValues.reduce((a, b) => a + b, 0) / occ.opennessValues.length;
    const avgComplexity = occ.complexities.reduce((a, b) => a + b, 0) / occ.complexities.length;
    const avgConflict = occ.conflicts.reduce((a, b) => a + b, 0) / occ.conflicts.length;

    const baseRadius = 1.72 + importance * 0.45 + avgIntensity * 0.15;

    const sortedCoOccurring = Array.from(occ.coOccurredWith.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .filter((name) => name !== arch.shortLabel);

    const primaryQuote =
      occ.representativeQuotes[0]?.quote || `Observed across ${occ.entryCount} reflections`;

    return {
      id: `node-agg-${arch.keyword}-${i}`,
      label: arch.shortLabel,
      shortLabel: arch.shortLabel,
      category: arch.category,
      groundedQuote: primaryQuote,
      experientialAtmosphere: arch.experientialTheme,
      narrativeSignificance: `Expressed across ${occ.entryCount} of ${totalEntriesInPeriod} reflections (${frequencyPercent}%) in ${periodLabel}`,
      intensity: avgIntensity,
      weight: avgWeight,
      calmness: avgCalmness,
      instability: avgInstability,
      openness: avgOpenness,
      emotionalDistance: 1.0 - importance,
      complexity: avgComplexity,
      conflict: avgConflict,
      narrativeImportance: importance,
      outerForm: arch.outerForm,
      surfaceBehavior: arch.surfaceBehavior,
      materialType: arch.materialType,
      colorSpec: arch.color,
      baseRadius: Number(baseRadius.toFixed(2)),
      frequencyPercent,
      entryCount: occ.entryCount,
      coOccurringConcepts: sortedCoOccurring.slice(0, 4),
      aggregateMeta: {
        entryCount: occ.entryCount,
        totalEntriesInPeriod,
        frequencyPercentage: frequencyPercent,
        representativeQuotes: occ.representativeQuotes,
        relatedConcepts: sortedCoOccurring.slice(0, 4),
      },
    };
  });

  const rawCentral: RawNodeCandidate = {
    id: centralNode.id,
    label: centralNode.label,
    shortLabel: centralNode.shortLabel,
    category: centralNode.category,
    groundedQuote: centralNode.groundedQuote,
    experientialAtmosphere: centralNode.experientialAtmosphere,
    narrativeSignificance: centralNode.narrativeSignificance,
    intensity: centralNode.intensity,
    weight: centralNode.weight,
    calmness: centralNode.calmness,
    instability: centralNode.instability,
    openness: centralNode.openness,
    emotionalDistance: centralNode.emotionalDistance,
    complexity: centralNode.complexity,
    conflict: centralNode.conflict,
    narrativeImportance: centralNode.narrativeImportance,
    outerForm: centralNode.outerForm,
    surfaceBehavior: centralNode.surfaceBehavior,
    materialType: centralNode.materialType,
    colorSpec: centralNode.colorSpec,
    baseRadius: 3.5,
  };

  const seed = Math.abs(hashString(`aggregate-${period}-${startDate.getTime()}`));
  const layoutResult = buildSpaciousSolarLayout(rawCentral, rawSatellites, seed);
  const nodes = layoutResult.nodes;
  const connections = layoutResult.connections;

  // Populate connectedDirections on each node for biological organic trumpet sculpts
  const nodeMap = new Map<string, LandscapeNode>();
  nodes.forEach((n) => {
    nodeMap.set(n.id, n);
    n.connectedDirections = [];
  });

  connections.forEach((conn) => {
    const src = nodeMap.get(conn.sourceId);
    const tgt = nodeMap.get(conn.targetId);
    if (src && tgt) {
      const dx = tgt.position[0] - src.position[0];
      const dy = tgt.position[1] - src.position[1];
      const dz = tgt.position[2] - src.position[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

      src.connectedDirections?.push([dx / len, dy / len, dz / len]);
      tgt.connectedDirections?.push([-dx / len, -dy / len, -dz / len]);
    }
  });

  // Global Atmosphere calculation
  const avgCalmness = nodes.reduce((acc, n) => acc + n.calmness, 0) / nodes.length;
  const avgConflict = nodes.reduce((acc, n) => acc + n.conflict, 0) / nodes.length;

  let temperature: EmotionalLandscapeData['globalAtmosphere']['temperature'] = 'neutral_still';
  let dominantFeel = `Equilibrium & Emerging Themes (${totalEntriesInPeriod} Reflections)`;
  let ambientLightColor = '#dde4ed';
  let fogColor = '#13141a';

  if (avgConflict > 0.42 || stressIndex > 7) {
    temperature = 'charged_tense';
    dominantFeel = `Underlying Strain & Cognitive Searching (${totalEntriesInPeriod} Reflections)`;
    ambientLightColor = '#ebdbe0';
    fogColor = '#161419';
  } else if (avgCalmness > 0.65) {
    temperature = 'warm_intimate';
    dominantFeel = `Grounded Continuity & Solace (${totalEntriesInPeriod} Reflections)`;
    ambientLightColor = '#faefe0';
    fogColor = '#151419';
  }

  return {
    entryId: `aggregate-${period}-${startDate.getTime()}`,
    entryTitle: periodLabel,
    centralIncidentSummary: `Aggregate landscape of ${nodes.length - 1} recurring themes across ${totalEntriesInPeriod} reflection${totalEntriesInPeriod > 1 ? 's' : ''}`,
    hasSufficientData: true,
    wordCount: totalWordCount,
    nodes,
    connections,
    mode: 'patterns',
    timePeriod: period,
    periodLabel,
    periodDateRange,
    entryCountInPeriod: totalEntriesInPeriod,
    globalAtmosphere: {
      dominantFeel,
      temperature,
      ambientLightColor,
      fogColor,
      fogDensity: 0.005,
    },
    telemetryModulation: {
      stressDampening: Number((1.0 - stressMod * 0.4).toFixed(2)),
      focusClarity: Number((0.6 + focusMod * 0.3).toFixed(2)),
      creativityBranching: Number((0.5 + creativityMod * 0.4).toFixed(2)),
    },
  };
}
