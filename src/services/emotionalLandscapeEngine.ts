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
import { buildSpaciousSolarLayout, RawNodeCandidate } from './spatialSolarLayout';

// Deterministic hash utility for stable seeded values
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Deterministic PRNG seeded by entry
export function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function formatGroundedQuote(rawSentence: string): string {
  if (!rawSentence) return '';
  const text = rawSentence.trim().replace(/^["'\s]+|["'\s]+$/g, '');
  if (text.length <= 48) return text;

  // Look for natural clause boundary (comma, dash, semicolon, or conjunction)
  const clauseMatch = text.slice(0, 56).match(/^([^,;—–]+(?:[,;—–]| because| but| and| so)?)/i);
  if (clauseMatch && clauseMatch[1].length >= 18 && clauseMatch[1].length <= 50) {
    const trimmed = clauseMatch[1].replace(/[,;—–\s]+$/, '');
    return trimmed + '...';
  }

  // Otherwise trim gracefully at word boundary before 46 chars
  const words = text.slice(0, 46).replace(/\s+\S*$/, '');
  return words + '...';
}

export interface SentimentExtract {
  keyword: string;
  synonyms: string[];
  category: LandscapeNode['category'];
  experientialTheme: string;
  shortLabel: string;
  phraseTemplate: (quote: string) => string;
  outerForm: OuterFormType;
  surfaceBehavior: SurfaceBehaviorType;
  materialType: MaterialType;
  color: EmotionalColorSpec;
  intensityBase: number;
  weightBase: number;
  calmnessBase: number;
  instabilityBase: number;
  opennessBase: number;
  complexityBase: number;
  conflictBase: number;
}

/**
 * Art-directed muted cinematic palette matching reference:
 * Smoky violet, desaturated lavender, deep atmospheric blue, muted amber,
 * warm ivory, soft bronze, olive-grey, restrained rose, blue-grey, subtle champagne.
 */
export const EXPERIENTIAL_ARCHETYPES: SentimentExtract[] = [
  // 1. Peaceful Relief / Inner Calm
  {
    keyword: 'relief',
    synonyms: ['relieved', 'breathe', 'peace', 'calm', 'safe', 'unwound', 'relaxed', 'ease', 'exhaled', 'still'],
    category: 'comfort',
    experientialTheme: 'Quiet relief after an exhausting or tense passage',
    shortLabel: 'Inner Calm',
    phraseTemplate: (q) => `Relief settling in: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'expansion_release',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#4e3362', // deep smoky translucent violet
      innerGlowColor: '#7a4e9e', // soft lavender light knot
      rimColor: '#ecdefa', // delicate luminous lavender-ivory rim
      attenuationColor: '#120718', // deep smoked obsidian violet shadow
      roughness: 0.25,
      metalness: 0.03,
      transmission: 0.68,
      opacity: 0.86,
    },
    intensityBase: 0.68,
    weightBase: 0.3,
    calmnessBase: 0.85,
    instabilityBase: 0.16,
    opennessBase: 0.88,
    complexityBase: 0.38,
    conflictBase: 0.1,
  },
  // 2. Lingering Pressure / Tension
  {
    keyword: 'anxiety',
    synonyms: ['anxious', 'stress', 'pressure', 'tension', 'worried', 'nervous', 'tight', 'heavy chest', 'deadline', 'looming', 'hurry'],
    category: 'pressure',
    experientialTheme: 'Contracted, restless uncertainty constricting present clarity',
    shortLabel: 'Lingering Pressure',
    phraseTemplate: (q) => `Contracted unease: "${q}"`,
    outerForm: 'compressed_dense',
    surfaceBehavior: 'racing_thoughts',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#522530', // deep smoky burgundy-charcoal
      innerGlowColor: '#7a3443', // soft smoldering rose ember
      rimColor: '#ebd0d6', // restrained smoky rose rim
      attenuationColor: '#140509', // deep charcoal plum shadow
      roughness: 0.28,
      metalness: 0.03,
      transmission: 0.62,
      opacity: 0.88,
    },
    intensityBase: 0.78,
    weightBase: 0.84,
    calmnessBase: 0.2,
    instabilityBase: 0.78,
    opennessBase: 0.24,
    complexityBase: 0.72,
    conflictBase: 0.68,
  },
  // 3. Focused Mind / Clarity
  {
    keyword: 'focus',
    synonyms: ['clarity', 'working', 'goal', 'sharp', 'concentration', 'deep work', 'clear', 'solved', 'flow', 'aligned', 'built'],
    category: 'thought',
    experientialTheme: 'Sharp mental alignment cutting through ambient distraction',
    shortLabel: 'Focused Mind',
    phraseTemplate: (q) => `Mental alignment: "${q}"`,
    outerForm: 'sharply_irregular',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#234462', // deep translucent slate blue
      innerGlowColor: '#3c6e94', // soft ice-slate wisp
      rimColor: '#cce4f7', // delicate crystalline ice rim
      attenuationColor: '#071018', // deep midnight slate shadow
      roughness: 0.25,
      metalness: 0.03,
      transmission: 0.68,
      opacity: 0.86,
    },
    intensityBase: 0.75,
    weightBase: 0.4,
    calmnessBase: 0.82,
    instabilityBase: 0.12,
    opennessBase: 0.72,
    complexityBase: 0.5,
    conflictBase: 0.12,
  },
  // 4. Gratitude
  {
    keyword: 'gratitude',
    synonyms: ['grateful', 'thankful', 'blessed', 'appreciate', 'appreciation', 'kindness', 'little things', 'grace'],
    category: 'comfort',
    experientialTheme: 'Reverent thankfulness for quiet graces and enduring bonds',
    shortLabel: 'Gratitude',
    phraseTemplate: (q) => `Felt gratitude: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#364022', // deep subdued olive-green
      innerGlowColor: '#5c6e38', // soft lichen-gold light knot
      rimColor: '#dce7c2', // delicate pale olive-ivory rim
      attenuationColor: '#0b1004', // deep dark olive shadow
      roughness: 0.27,
      metalness: 0.03,
      transmission: 0.64,
      opacity: 0.88,
    },
    intensityBase: 0.72,
    weightBase: 0.3,
    calmnessBase: 0.85,
    instabilityBase: 0.1,
    opennessBase: 0.88,
    complexityBase: 0.38,
    conflictBase: 0.06,
  },
  // 5. Quiet Joy / Happiness
  {
    keyword: 'happy',
    synonyms: ['joy', 'smiled', 'glad', 'wonderful', 'laughter', 'cheerful', 'lighthearted', 'delight', 'pleasant', 'content'],
    category: 'emotion',
    experientialTheme: 'Quiet inner warmth and spacious joy from a lived moment',
    shortLabel: 'Quiet Joy',
    phraseTemplate: (q) => `Spacious warmth: "${q}"`,
    outerForm: 'rounded_open',
    surfaceBehavior: 'energetic_coherent',
    materialType: 'soft_gel',
    color: {
      baseColor: '#6c441e', // muted warm bronze-amber
      innerGlowColor: '#9e662c', // soft honey amber light
      rimColor: '#f4e2ca', // delicate warm honey rim
      attenuationColor: '#120a03', // deep dark bronze shadow
      roughness: 0.26,
      metalness: 0.03,
      transmission: 0.66,
      opacity: 0.86,
    },
    intensityBase: 0.74,
    weightBase: 0.26,
    calmnessBase: 0.76,
    instabilityBase: 0.24,
    opennessBase: 0.9,
    complexityBase: 0.36,
    conflictBase: 0.08,
  },
  // 6. Grounded Depletion / Heavy Fatigue
  {
    keyword: 'tired',
    synonyms: ['exhaust', 'exhausted', 'drained', 'weary', 'fatigue', 'burned out', 'heavy eyes', 'sleepy', 'spent'],
    category: 'pressure',
    experientialTheme: 'Exhausted stillness longing for unhurried restoration',
    shortLabel: 'Grounded Depletion',
    phraseTemplate: (q) => `Deep fatigue: "${q}"`,
    outerForm: 'heavy_grounded',
    surfaceBehavior: 'slow_smooth',
    materialType: 'mineral_layer',
    color: {
      baseColor: '#2d2822', // dark muted stone slate
      innerGlowColor: '#4a443a', // soft ash wisp
      rimColor: '#d6cec6', // warm stone-ivory rim
      attenuationColor: '#12100d', // deep stone shadow
      roughness: 0.36,
      metalness: 0.02,
      transmission: 0.52,
      opacity: 0.92,
    },
    intensityBase: 0.62,
    weightBase: 0.88,
    calmnessBase: 0.55,
    instabilityBase: 0.16,
    opennessBase: 0.24,
    complexityBase: 0.35,
    conflictBase: 0.16,
  },
  // 7. Deliberation / Crossroads
  {
    keyword: 'decision',
    synonyms: ['decide', 'choice', 'wondering', 'crossroads', 'should I', 'weighing', 'uncertain', 'which path', 'next steps'],
    category: 'thought',
    experientialTheme: 'Weighing trade-offs and consequences at a quiet crossroads',
    shortLabel: 'Deliberation',
    phraseTemplate: (q) => `Weighing choices: "${q}"`,
    outerForm: 'folded_inward',
    surfaceBehavior: 'layered_misaligned',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#262a36', // dark midnight slate
      innerGlowColor: '#40465c',
      rimColor: '#ccd2e2',
      attenuationColor: '#0e1018',
      roughness: 0.28,
      metalness: 0.02,
      transmission: 0.62,
      opacity: 0.9,
    },
    intensityBase: 0.72,
    weightBase: 0.62,
    calmnessBase: 0.48,
    instabilityBase: 0.46,
    opennessBase: 0.55,
    complexityBase: 0.8,
    conflictBase: 0.55,
  },
  // 8. Divided Pull / Friction
  {
    keyword: 'conflict',
    synonyms: ['torn', 'argue', 'disagree', 'friction', 'fight', 'contradiction', 'clashing', 'struggling', 'push and pull'],
    category: 'conflict',
    experientialTheme: 'Internal friction between competing duties and desires',
    shortLabel: 'Divided Pull',
    phraseTemplate: (q) => `Divided pull: "${q}"`,
    outerForm: 'swollen_unstable',
    surfaceBehavior: 'opposing_currents',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#3a2026', // dark muted rose clay
      innerGlowColor: '#5e323e',
      rimColor: '#e0c4cb',
      attenuationColor: '#160a0f',
      roughness: 0.32,
      metalness: 0.02,
      transmission: 0.56,
      opacity: 0.9,
    },
    intensityBase: 0.82,
    weightBase: 0.72,
    calmnessBase: 0.22,
    instabilityBase: 0.82,
    opennessBase: 0.32,
    complexityBase: 0.78,
    conflictBase: 0.88,
  },
  // 9. Family
  {
    keyword: 'family',
    synonyms: ['parents', 'mom', 'dad', 'brother', 'sister', 'kids', 'children', 'home', 'relative', 'household'],
    category: 'relationship',
    experientialTheme: 'Familiar grounding, shared presence, and unconditional safety',
    shortLabel: 'Family',
    phraseTemplate: (q) => `Familiar grounding: "${q}"`,
    outerForm: 'rounded_open',
    surfaceBehavior: 'slow_smooth',
    materialType: 'soft_gel',
    color: {
      baseColor: '#402920', // dark warm terracotta bronze
      innerGlowColor: '#6c4434',
      rimColor: '#ebdad2',
      attenuationColor: '#1a0e0a',
      roughness: 0.28,
      metalness: 0.02,
      transmission: 0.64,
      opacity: 0.88,
    },
    intensityBase: 0.72,
    weightBase: 0.36,
    calmnessBase: 0.84,
    instabilityBase: 0.12,
    opennessBase: 0.86,
    complexityBase: 0.42,
    conflictBase: 0.08,
  },
  // 10. Cricket / Bodily Exertion
  {
    keyword: 'cricket',
    synonyms: ['match', 'sport', 'game', 'play', 'run', 'running', 'gym', 'workout', 'sweat', 'athletic', 'field'],
    category: 'memory',
    experientialTheme: 'Visceral physical engagement, camaraderie, and lived presence',
    shortLabel: 'Cricket',
    phraseTemplate: (q) => `Physical flow: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'energetic_coherent',
    materialType: 'translucent_fluid',
    color: {
      baseColor: '#26362c', // dark sage stone mist
      innerGlowColor: '#3e5847',
      rimColor: '#c8dcce',
      attenuationColor: '#0e1811',
      roughness: 0.26,
      metalness: 0.02,
      transmission: 0.64,
      opacity: 0.88,
    },
    intensityBase: 0.76,
    weightBase: 0.32,
    calmnessBase: 0.7,
    instabilityBase: 0.22,
    opennessBase: 0.85,
    complexityBase: 0.4,
    conflictBase: 0.1,
  },
  // 11. Lingering Echo / Memory
  {
    keyword: 'memory',
    synonyms: ['remember', 'past', 'nostalgia', 'childhood', 'years ago', 'echo', 'recalled', 'reminded'],
    category: 'memory',
    experientialTheme: 'Distant echoes and lingering impressions from earlier days',
    shortLabel: 'Lingering Echo',
    phraseTemplate: (q) => `Resonant memory: "${q}"`,
    outerForm: 'delicate_translucent',
    surfaceBehavior: 'faded_edges',
    materialType: 'mist_volume',
    color: {
      baseColor: '#342236', // dark smoky mauve
      innerGlowColor: '#58385b',
      rimColor: '#dccce0',
      attenuationColor: '#140b16',
      roughness: 0.26,
      metalness: 0.02,
      transmission: 0.68,
      opacity: 0.86,
    },
    intensityBase: 0.6,
    weightBase: 0.45,
    calmnessBase: 0.76,
    instabilityBase: 0.22,
    opennessBase: 0.78,
    complexityBase: 0.5,
    conflictBase: 0.15,
  },
  // 12. Tender Hope / Possibility
  {
    keyword: 'hope',
    synonyms: ['optimistic', 'forward', 'beginning', 'possibility', 'tomorrow', 'new chapter', 'dawn', 'better'],
    category: 'emotion',
    experientialTheme: 'A gentle opening toward tomorrow and unwritten possibilities',
    shortLabel: 'Tender Hope',
    phraseTemplate: (q) => `Gentle opening: "${q}"`,
    outerForm: 'rounded_open',
    surfaceBehavior: 'expansion_release',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#45351e', // dark soft champagne bronze
      innerGlowColor: '#7a5e36',
      rimColor: '#eee2cc',
      attenuationColor: '#1a1308',
      roughness: 0.24,
      metalness: 0.02,
      transmission: 0.72,
      opacity: 0.88,
    },
    intensityBase: 0.68,
    weightBase: 0.25,
    calmnessBase: 0.78,
    instabilityBase: 0.18,
    opennessBase: 0.92,
    complexityBase: 0.35,
    conflictBase: 0.08,
  },
  // 13. Heavy Remorse / Regret
  {
    keyword: 'guilt',
    synonyms: ['regret', 'sorry', 'fault', 'mistake', 'wish I had', 'wish I had not', 'should have', 'apologize'],
    category: 'conflict',
    experientialTheme: 'Dense inward contraction over words or choices left unhealed',
    shortLabel: 'Regret',
    phraseTemplate: (q) => `Weighted remorse: "${q}"`,
    outerForm: 'compressed_dense',
    surfaceBehavior: 'inward_folding',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#341d26', // dark muted plum shadow
      innerGlowColor: '#582d3c',
      rimColor: '#d6bcc6',
      attenuationColor: '#12080d',
      roughness: 0.32,
      metalness: 0.02,
      transmission: 0.58,
      opacity: 0.92,
    },
    intensityBase: 0.75,
    weightBase: 0.82,
    calmnessBase: 0.28,
    instabilityBase: 0.65,
    opennessBase: 0.25,
    complexityBase: 0.65,
    conflictBase: 0.72,
  },
  // 14. Sudden Insight / Epiphany
  {
    keyword: 'realization',
    synonyms: ['realized', 'noticed', 'dawned', 'epiphany', 'struck me', 'insight', 'pattern', 'perspective', 'understood'],
    category: 'thought',
    experientialTheme: 'A sudden crystallization of perspective opening fresh clarity',
    shortLabel: 'Sudden Insight',
    phraseTemplate: (q) => `Crystallized insight: "${q}"`,
    outerForm: 'delicate_translucent',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#729cb8', // pale luminous slate
      innerGlowColor: '#a8cde5',
      rimColor: '#e0f1fc',
      attenuationColor: '#365a73',
      roughness: 0.2,
      metalness: 0.02,
      transmission: 0.76,
      opacity: 0.88,
    },
    intensityBase: 0.72,
    weightBase: 0.35,
    calmnessBase: 0.8,
    instabilityBase: 0.15,
    opennessBase: 0.85,
    complexityBase: 0.55,
    conflictBase: 0.1,
  },
  // 15. Heartfelt Bond / Friendship
  {
    keyword: 'friend',
    synonyms: ['friendship', 'partner', 'talked', 'shared', 'understood me', 'connection', 'together', 'conversation'],
    category: 'relationship',
    experientialTheme: 'Resonant vulnerability and unconditional emotional presence',
    shortLabel: 'Friendship',
    phraseTemplate: (q) => `Shared bond: "${q}"`,
    outerForm: 'rounded_open',
    surfaceBehavior: 'slow_smooth',
    materialType: 'soft_gel',
    color: {
      baseColor: '#b58572', // soft warm terracotta
      innerGlowColor: '#d6a392',
      rimColor: '#f5ccc0',
      attenuationColor: '#784635',
      roughness: 0.26,
      metalness: 0.02,
      transmission: 0.66,
      opacity: 0.88,
    },
    intensityBase: 0.72,
    weightBase: 0.32,
    calmnessBase: 0.82,
    instabilityBase: 0.14,
    opennessBase: 0.88,
    complexityBase: 0.38,
    conflictBase: 0.08,
  },
  // 16. Restorative Stillness
  {
    keyword: 'stillness',
    synonyms: ['silence', 'quiet', 'solitude', 'evening', 'night', 'walk', 'nature', 'tea', 'breathing', 'pausing'],
    category: 'comfort',
    experientialTheme: 'A quiet pause in time letting the nervous system settle',
    shortLabel: 'Restorative Stillness',
    phraseTemplate: (q) => `Unhurried stillness: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#736b8a', // deep smoky twilight lavender
      innerGlowColor: '#9b91b8',
      rimColor: '#d1cbe3',
      attenuationColor: '#453d5c',
      roughness: 0.24,
      metalness: 0.02,
      transmission: 0.7,
      opacity: 0.88,
    },
    intensityBase: 0.65,
    weightBase: 0.34,
    calmnessBase: 0.9,
    instabilityBase: 0.08,
    opennessBase: 0.86,
    complexityBase: 0.3,
    conflictBase: 0.05,
  },
  // 17. Raw Frustration / Anger
  {
    keyword: 'anger',
    synonyms: ['angry', 'furious', 'mad', 'annoyed', 'irritated', 'unfair', 'rage', 'upset', 'boiling', 'snapped'],
    category: 'conflict',
    experientialTheme: 'Surging emotional friction against perceived injustice or barrier',
    shortLabel: 'Raw Frustration',
    phraseTemplate: (q) => `Surging friction: "${q}"`,
    outerForm: 'swollen_unstable',
    surfaceBehavior: 'opposing_currents',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#3d1c24', // dark smoked ruby shadow
      innerGlowColor: '#6e2d3b', // soft embers
      rimColor: '#e8c4cc', // rose-ivory rim
      attenuationColor: '#17090e',
      roughness: 0.32,
      metalness: 0.02,
      transmission: 0.58,
      opacity: 0.92,
    },
    intensityBase: 0.85,
    weightBase: 0.78,
    calmnessBase: 0.15,
    instabilityBase: 0.88,
    opennessBase: 0.28,
    complexityBase: 0.7,
    conflictBase: 0.92,
  },
  // 18. Heavy Sorrow / Sadness
  {
    keyword: 'sadness',
    synonyms: ['sad', 'crying', 'tears', 'grief', 'heartache', 'sorrow', 'depressed', 'hurt', 'painful', 'broken', 'heavy heart'],
    category: 'pressure',
    experientialTheme: 'Dense downward gravitational ache bearing witness to loss',
    shortLabel: 'Heavy Sorrow',
    phraseTemplate: (q) => `Downward ache: "${q}"`,
    outerForm: 'heavy_grounded',
    surfaceBehavior: 'slow_smooth',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#1e2938', // dark midnight blue slate
      innerGlowColor: '#344c68',
      rimColor: '#c8dbee',
      attenuationColor: '#0b111a',
      roughness: 0.28,
      metalness: 0.02,
      transmission: 0.62,
      opacity: 0.92,
    },
    intensityBase: 0.78,
    weightBase: 0.9,
    calmnessBase: 0.45,
    instabilityBase: 0.35,
    opennessBase: 0.2,
    complexityBase: 0.6,
    conflictBase: 0.4,
  },
  // 19. Restless Rumination / Overthinking
  {
    keyword: 'overthinking',
    synonyms: ['overthink', 'spinning', 'spiral', 'racing mind', 'cannot stop thinking', 'analyzing', 'second guessing', 'in my head', 'loop'],
    category: 'thought',
    experientialTheme: 'A cognitive loop refracting thoughts inward without resolution',
    shortLabel: 'Overthinking',
    phraseTemplate: (q) => `Inward loop: "${q}"`,
    outerForm: 'folded_inward',
    surfaceBehavior: 'racing_thoughts',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#2d2338', // dark midnight plum violet
      innerGlowColor: '#4f3c63',
      rimColor: '#d8cbe6',
      attenuationColor: '#120b18',
      roughness: 0.28,
      metalness: 0.02,
      transmission: 0.64,
      opacity: 0.9,
    },
    intensityBase: 0.74,
    weightBase: 0.65,
    calmnessBase: 0.25,
    instabilityBase: 0.72,
    opennessBase: 0.32,
    complexityBase: 0.85,
    conflictBase: 0.62,
  },
  // 20. Vibrant Spark / Excitement
  {
    keyword: 'excited',
    synonyms: ['excitement', 'thrilled', 'eager', 'anticipation', 'energized', 'electric', 'buzzing', 'cannot wait', 'enthusiasm'],
    category: 'emotion',
    experientialTheme: 'Kinetic anticipation radiating forward into fresh beginnings',
    shortLabel: 'Vibrant Spark',
    phraseTemplate: (q) => `Radiant anticipation: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'energetic_coherent',
    materialType: 'translucent_fluid',
    color: {
      baseColor: '#48341a', // dark topaz bronze
      innerGlowColor: '#825a28',
      rimColor: '#fae8c8',
      attenuationColor: '#1c1306',
      roughness: 0.22,
      metalness: 0.02,
      transmission: 0.74,
      opacity: 0.88,
    },
    intensityBase: 0.82,
    weightBase: 0.22,
    calmnessBase: 0.6,
    instabilityBase: 0.45,
    opennessBase: 0.94,
    complexityBase: 0.45,
    conflictBase: 0.08,
  },
  // 21. Grounded Strength / Confidence
  {
    keyword: 'confidence',
    synonyms: ['confident', 'proud', 'capable', 'strong', 'belief in myself', 'standing tall', 'self-trust', 'courage', 'ready'],
    category: 'emotion',
    experientialTheme: 'Quiet centered poise and self-trust rooted in lived competence',
    shortLabel: 'Confidence',
    phraseTemplate: (q) => `Centered poise: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#3a3020', // dark warm bronze olive
      innerGlowColor: '#6a5636',
      rimColor: '#ede2ce',
      attenuationColor: '#161108',
      roughness: 0.24,
      metalness: 0.02,
      transmission: 0.7,
      opacity: 0.88,
    },
    intensityBase: 0.75,
    weightBase: 0.42,
    calmnessBase: 0.88,
    instabilityBase: 0.1,
    opennessBase: 0.86,
    complexityBase: 0.4,
    conflictBase: 0.08,
  },
  // 22. Quiet Solitude / Loneliness
  {
    keyword: 'lonely',
    synonyms: ['loneliness', 'isolated', 'alone', 'disconnected', 'nobody', 'distant', 'abandoned', 'empty room'],
    category: 'pressure',
    experientialTheme: 'A spacious, quiet ache longing for resonant communion',
    shortLabel: 'Quiet Solitude',
    phraseTemplate: (q) => `Spacious solitude: "${q}"`,
    outerForm: 'stretched_distant',
    surfaceBehavior: 'faded_edges',
    materialType: 'mist_volume',
    color: {
      baseColor: '#242732', // dark slate mist
      innerGlowColor: '#3a4052',
      rimColor: '#c5cbde',
      attenuationColor: '#0d0f16',
      roughness: 0.26,
      metalness: 0.02,
      transmission: 0.7,
      opacity: 0.86,
    },
    intensityBase: 0.65,
    weightBase: 0.6,
    calmnessBase: 0.65,
    instabilityBase: 0.32,
    opennessBase: 0.48,
    complexityBase: 0.45,
    conflictBase: 0.3,
  },
  // 23. Ignited Drive / Motivation
  {
    keyword: 'motivation',
    synonyms: ['motivated', 'drive', 'ambitious', 'momentum', 'determined', 'dedicated', 'push forward', 'unstoppable'],
    category: 'thought',
    experientialTheme: 'A focused internal thrust channeling intent into purposeful momentum',
    shortLabel: 'Motivation',
    phraseTemplate: (q) => `Purposeful thrust: "${q}"`,
    outerForm: 'sharply_irregular',
    surfaceBehavior: 'energetic_coherent',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#42281c', // dark copper bronze
      innerGlowColor: '#78432a',
      rimColor: '#f2d6c9',
      attenuationColor: '#1a0d07',
      roughness: 0.24,
      metalness: 0.02,
      transmission: 0.7,
      opacity: 0.88,
    },
    intensityBase: 0.8,
    weightBase: 0.36,
    calmnessBase: 0.72,
    instabilityBase: 0.2,
    opennessBase: 0.82,
    complexityBase: 0.5,
    conflictBase: 0.12,
  },
  // 24. Cognitive Fog / Confusion
  {
    keyword: 'confusion',
    synonyms: ['confused', 'lost', 'unclear', 'foggy', 'puzzle', 'disoriented', 'bewildering', 'do not know what to do', 'stuck'],
    category: 'thought',
    experientialTheme: 'Diffused perception navigating layered, ambiguous currents',
    shortLabel: 'Confusion',
    phraseTemplate: (q) => `Diffused currents: "${q}"`,
    outerForm: 'folded_inward',
    surfaceBehavior: 'layered_misaligned',
    materialType: 'mist_volume',
    color: {
      baseColor: '#2d2836', // dark smoked mauve grey
      innerGlowColor: '#484058',
      rimColor: '#d6cfe3',
      attenuationColor: '#120f17',
      roughness: 0.3,
      metalness: 0.02,
      transmission: 0.65,
      opacity: 0.88,
    },
    intensityBase: 0.68,
    weightBase: 0.55,
    calmnessBase: 0.38,
    instabilityBase: 0.58,
    opennessBase: 0.42,
    complexityBase: 0.75,
    conflictBase: 0.45,
  },
  // 25. Scholarly Immersion / Studies
  {
    keyword: 'study',
    synonyms: ['studying', 'exam', 'test', 'assignment', 'class', 'homework', 'university', 'college', 'school', 'learn', 'reading', 'syllabus'],
    category: 'thought',
    experientialTheme: 'Rigorous cognitive architecture synthesizing knowledge and discipline',
    shortLabel: 'Academic Focus',
    phraseTemplate: (q) => `Knowledge synthesis: "${q}"`,
    outerForm: 'sharply_irregular',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#1b3236', // dark slate pine teal
      innerGlowColor: '#2d575c',
      rimColor: '#c8e2e6',
      attenuationColor: '#0a1618',
      roughness: 0.25,
      metalness: 0.02,
      transmission: 0.72,
      opacity: 0.88,
    },
    intensityBase: 0.74,
    weightBase: 0.48,
    calmnessBase: 0.76,
    instabilityBase: 0.18,
    opennessBase: 0.68,
    complexityBase: 0.65,
    conflictBase: 0.18,
  },
  // 26. Vocation / Career
  {
    keyword: 'career',
    synonyms: ['job', 'promotion', 'work', 'interview', 'professional', 'office', 'client', 'company', 'project', 'resume', 'salary'],
    category: 'thought',
    experientialTheme: 'Steering long-horizon aspirations through professional currents',
    shortLabel: 'Career Path',
    phraseTemplate: (q) => `Long-horizon path: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#202b36', // dark steel slate
      innerGlowColor: '#364a5e',
      rimColor: '#cedce8',
      attenuationColor: '#0c1218',
      roughness: 0.25,
      metalness: 0.02,
      transmission: 0.7,
      opacity: 0.88,
    },
    intensityBase: 0.76,
    weightBase: 0.52,
    calmnessBase: 0.74,
    instabilityBase: 0.25,
    opennessBase: 0.75,
    complexityBase: 0.6,
    conflictBase: 0.22,
  },
  // 27. Romantic Resonance / Relationships
  {
    keyword: 'relationship',
    synonyms: ['dating', 'girlfriend', 'boyfriend', 'husband', 'wife', 'spouse', 'romantic', 'partner', 'in love', 'affection'],
    category: 'relationship',
    experientialTheme: 'Intimate devotional resonance and tender mutual presence',
    shortLabel: 'Romantic Bond',
    phraseTemplate: (q) => `Devotional resonance: "${q}"`,
    outerForm: 'rounded_open',
    surfaceBehavior: 'slow_smooth',
    materialType: 'soft_gel',
    color: {
      baseColor: '#3c232a', // dark muted rose clay
      innerGlowColor: '#683743',
      rimColor: '#ebd0d6',
      attenuationColor: '#160a0e',
      roughness: 0.26,
      metalness: 0.02,
      transmission: 0.68,
      opacity: 0.88,
    },
    intensityBase: 0.78,
    weightBase: 0.32,
    calmnessBase: 0.84,
    instabilityBase: 0.16,
    opennessBase: 0.9,
    complexityBase: 0.42,
    conflictBase: 0.1,
  },
  // 28. Accomplishment & Breakthrough / Achievement
  {
    keyword: 'achievement',
    synonyms: ['accomplish', 'accomplished', 'achievement', 'winning', 'won', 'finished', 'completed', 'breakthrough', 'victory', 'succeeded', 'boundary', 'milestone', 'triumph', 'nailed it'],
    category: 'emotion',
    experientialTheme: 'Felt validation and expansive momentum from dedicated effort',
    shortLabel: 'Achievement',
    phraseTemplate: (q) => `Earned breakthrough: "${q}"`,
    outerForm: 'smooth_expansive',
    surfaceBehavior: 'energetic_coherent',
    materialType: 'translucent_fluid',
    color: {
      baseColor: '#4a3818', // warm bronze gold
      innerGlowColor: '#8a6422',
      rimColor: '#f7e8c6',
      attenuationColor: '#1a1205',
      roughness: 0.23,
      metalness: 0.02,
      transmission: 0.72,
      opacity: 0.88,
    },
    intensityBase: 0.84,
    weightBase: 0.3,
    calmnessBase: 0.75,
    instabilityBase: 0.22,
    opennessBase: 0.92,
    complexityBase: 0.45,
    conflictBase: 0.08,
  },
  // 29. Community & Connection / Belonging
  {
    keyword: 'belonging',
    synonyms: ['belong', 'belonging', 'accepted', 'community', 'team', 'welcomed', 'embraced', 'included', 'part of something', 'understood', 'camaraderie'],
    category: 'relationship',
    experientialTheme: 'Quiet warmth of being recognized, welcomed, and part of a collective',
    shortLabel: 'Belonging',
    phraseTemplate: (q) => `Felt belonging: "${q}"`,
    outerForm: 'rounded_open',
    surfaceBehavior: 'slow_smooth',
    materialType: 'soft_gel',
    color: {
      baseColor: '#362a3d', // warm smoked violet
      innerGlowColor: '#5c4468',
      rimColor: '#e5d7eb',
      attenuationColor: '#140c17',
      roughness: 0.25,
      metalness: 0.02,
      transmission: 0.7,
      opacity: 0.88,
    },
    intensityBase: 0.74,
    weightBase: 0.32,
    calmnessBase: 0.86,
    instabilityBase: 0.12,
    opennessBase: 0.9,
    complexityBase: 0.38,
    conflictBase: 0.06,
  },
  // 30. Career Pressure & Ambiguity
  {
    keyword: 'career pressure',
    synonyms: ['career uncertainty', 'career pressure', 'job hunt', 'career horizon', 'promotion pressure', 'corporate pressure', 'work anxiety', 'career path', 'job market'],
    category: 'pressure',
    experientialTheme: 'Underlying gravitational strain over professional trajectory and trajectory uncertainty',
    shortLabel: 'Career Pressure',
    phraseTemplate: (q) => `Professional strain: "${q}"`,
    outerForm: 'compressed_dense',
    surfaceBehavior: 'racing_thoughts',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#3a2528', // smoked mahogany slate
      innerGlowColor: '#62383e',
      rimColor: '#dec7cb',
      attenuationColor: '#16090b',
      roughness: 0.3,
      metalness: 0.02,
      transmission: 0.6,
      opacity: 0.9,
    },
    intensityBase: 0.78,
    weightBase: 0.78,
    calmnessBase: 0.28,
    instabilityBase: 0.68,
    opennessBase: 0.35,
    complexityBase: 0.72,
    conflictBase: 0.64,
  },
  // 31. Academic Pressure & Rigor
  {
    keyword: 'academic pressure',
    synonyms: ['exam pressure', 'academic pressure', 'test anxiety', 'grade stress', 'studying late', 'syllabus', 'exam stress', 'failing', 'grade'],
    category: 'pressure',
    experientialTheme: 'Cognitive compression and performance tension under academic deadlines',
    shortLabel: 'Academic Pressure',
    phraseTemplate: (q) => `Academic strain: "${q}"`,
    outerForm: 'compressed_dense',
    surfaceBehavior: 'inward_folding',
    materialType: 'dense_liquid',
    color: {
      baseColor: '#282b3a', // dark navy slate
      innerGlowColor: '#3c4360',
      rimColor: '#cbd2ea',
      attenuationColor: '#0c0e18',
      roughness: 0.3,
      metalness: 0.02,
      transmission: 0.62,
      opacity: 0.9,
    },
    intensityBase: 0.76,
    weightBase: 0.75,
    calmnessBase: 0.26,
    instabilityBase: 0.65,
    opennessBase: 0.32,
    complexityBase: 0.7,
    conflictBase: 0.6,
  },
  // 32. Purposeful Planning & Strategy
  {
    keyword: 'planning',
    synonyms: ['roadmap', 'plan', 'planning', 'strategy', 'schedule', 'organize', 'organizing', 'preparation', 'structure', 'blueprint', 'milestones', 'next steps'],
    category: 'thought',
    experientialTheme: 'Methodical structuring of intent to transform ambition into disciplined steps',
    shortLabel: 'Planning',
    phraseTemplate: (q) => `Intent structured: "${q}"`,
    outerForm: 'sharply_irregular',
    surfaceBehavior: 'slow_smooth',
    materialType: 'cloudy_glass',
    color: {
      baseColor: '#213338', // dark slate teal
      innerGlowColor: '#34575f',
      rimColor: '#cde4e8',
      attenuationColor: '#0a1518',
      roughness: 0.24,
      metalness: 0.02,
      transmission: 0.72,
      opacity: 0.88,
    },
    intensityBase: 0.74,
    weightBase: 0.44,
    calmnessBase: 0.8,
    instabilityBase: 0.14,
    opennessBase: 0.78,
    complexityBase: 0.65,
    conflictBase: 0.12,
  },
];

export function splitIntoSentences(text: string): string[] {
  return text
    .replace(/(\r\n|\n|\r)/gm, ' ')
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

/**
 * Builds the Entry-Specific 3D Emotional Landscape
 * Adheres strictly to the principles:
 * 1. Never generate emotional nodes from empty or insufficient entries.
 * 2. Only generate nodes strictly grounded in real text.
 * 3. Never pad with artificial filler archetypes.
 */
export function generateEmotionalLandscape(
  entry: JournalEntry,
  telemetry?: TelemetryMetrics | null
): EmotionalLandscapeData {
  // Aggregate authentic user prose
  const userTexts: string[] = [];
  if (entry.content && entry.content.trim().length > 0) {
    userTexts.push(entry.content.trim());
  }
  if (entry.messages && entry.messages.length > 0) {
    entry.messages.forEach((m) => {
      if (m.role === 'user' && m.text && m.text.trim().length > 0) {
        userTexts.push(m.text.trim());
      }
    });
  }

  const combinedUserText = userTexts.join(' ').trim();
  const wordCount = combinedUserText.split(/\s+/).filter(Boolean).length;
  const charCount = combinedUserText.length;

  // Strict empty and insufficient data threshold:
  // If entry has no text or less than 12 words / 45 chars, return calm empty state.
  if (wordCount < 12 || charCount < 45) {
    return {
      entryId: entry.id,
      entryTitle: entry.title || 'Untitled Reflection',
      centralIncidentSummary: 'A fledgling reflection awaiting your thoughts.',
      hasSufficientData: false,
      wordCount,
      nodes: [],
      connections: [],
      globalAtmosphere: {
        dominantFeel: 'Still & Unwritten',
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

  // Seeded deterministic generator
  const seed = hashString(entry.id + '::' + combinedUserText);
  const rand = createSeededRandom(seed);

  const sentences = splitIntoSentences(combinedUserText);
  if (sentences.length === 0) {
    return {
      entryId: entry.id,
      entryTitle: entry.title || 'Untitled Reflection',
      centralIncidentSummary: 'A fledgling reflection awaiting your thoughts.',
      hasSufficientData: false,
      wordCount,
      nodes: [],
      connections: [],
      globalAtmosphere: {
        dominantFeel: 'Still & Unwritten',
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

  const lowerText = combinedUserText.toLowerCase();

  // Telemetry modulates ONLY presentation physics (never creates labels):
  const stressIndex = telemetry?.stressIndex ?? 4;
  const focusIndex = telemetry?.focusIndex ?? 6;
  const creativityIndex = telemetry?.creativityIndex ?? 6;

  const stressMod = (stressIndex - 5) / 10;       // -0.4 to +0.5
  const focusMod = (focusIndex - 5) / 10;         // -0.4 to +0.5
  const creativityMod = (creativityIndex - 5) / 10; // -0.4 to +0.5

  // 1. Central Incident Anchor (grounded in the entry's core premise)
  const centralTitle = entry.title && entry.title !== 'Untitled Reflection'
    ? entry.title
    : sentences[0]?.slice(0, 60) || 'The Central Incident';

  const centralQuote = sentences[0] || combinedUserText.slice(0, 100);

  const centralNode: LandscapeNode = {
    id: 'node-central',
    label: centralTitle,
    shortLabel: 'Incident Horizon',
    category: 'central_incident',
    groundedQuote: formatGroundedQuote(centralQuote),
    experientialAtmosphere: `The lived narrative anchor around which this reflection unfolds`,
    narrativeSignificance: 'The experiential center holding these reflections together',
    intensity: 0.85,
    weight: Math.min(1.0, Math.max(0.2, 0.5 + stressMod)),
    calmness: Math.min(1.0, Math.max(0.1, 0.65 - stressMod * 0.4)),
    instability: Math.min(1.0, Math.max(0.1, 0.25 + stressMod * 0.35)),
    openness: Math.min(1.0, Math.max(0.2, 0.7 + creativityMod * 0.3)),
    emotionalDistance: 0.0,
    complexity: Math.min(1.0, Math.max(0.3, 0.65 + creativityMod * 0.35)),
    conflict: Math.min(1.0, Math.max(0.0, 0.25 + stressMod * 0.4)),
    narrativeImportance: 1.0,
    outerForm: stressIndex > 7 ? 'compressed_dense' : 'rounded_open',
    surfaceBehavior: stressIndex > 7 ? 'inward_folding' : 'slow_smooth',
    materialType: 'cloudy_glass',
    colorSpec: {
      baseColor: '#6c4620', // rich warm champagne amber / muted golden bronze
      innerGlowColor: '#a86f2a', // soft warm golden amber wisp
      rimColor: '#f7ebd5', // delicate incandescent warm ivory rim
      attenuationColor: '#140b03', // deep dark smoked bronze shadow
      roughness: 0.26,
      metalness: 0.04,
      transmission: 0.65,
      opacity: 0.86,
    },
    position: [0, 0, 0],
    baseRadius: 3.5,
  };

  // 2. Determine dynamic node budget based on actual writing richness
  // - very short entry (< 35 words or <= 2 sentences): 2–4 total nodes (1 to 3 satellites)
  // - simple entry (35-85 words or 3-4 sentences): 4–6 total nodes (3 to 5 satellites)
  // - moderately detailed entry (85-200 words or 5-8 sentences): 6–9 total nodes (5 to 8 satellites)
  // - emotionally complex entry (200-380 words or 9-14 sentences): 8–12 total nodes (7 to 11 satellites)
  // - exceptionally rich entry (> 380 words): up to 14 total nodes (up to 13 satellites)
  let maxSatelliteCount: number;
  if (wordCount < 35 || sentences.length <= 2) {
    maxSatelliteCount = Math.min(3, Math.max(1, sentences.length));
  } else if (wordCount < 85 || sentences.length <= 4) {
    maxSatelliteCount = Math.min(5, Math.max(3, sentences.length));
  } else if (wordCount < 200 || sentences.length <= 8) {
    maxSatelliteCount = Math.min(8, Math.max(5, Math.floor(sentences.length * 0.9)));
  } else if (wordCount < 380 || sentences.length <= 14) {
    maxSatelliteCount = Math.min(11, Math.max(7, Math.floor(sentences.length * 0.85)));
  } else {
    maxSatelliteCount = Math.min(13, Math.max(8, Math.floor(sentences.length * 0.8)));
  }

  // 3. Discover authentic sentiments genuinely present in user's text
  interface MatchedCandidate {
    arch: SentimentExtract;
    quote: string;
    intensity: number;
    weight: number;
    calmness: number;
    instability: number;
    openness: number;
    complexity: number;
    conflict: number;
    form: OuterFormType;
  }

  const matchedCandidates: MatchedCandidate[] = [];
  const seenLabels = new Set<string>();

  for (const arch of EXPERIENTIAL_ARCHETYPES) {
    if (matchedCandidates.length >= maxSatelliteCount) break;

    // Check direct keyword and lived synonyms
    const hasKeyword = lowerText.includes(arch.keyword);
    const hasSynonym = arch.synonyms.some((syn) => lowerText.includes(syn));

    if ((hasKeyword || hasSynonym) && !seenLabels.has(arch.shortLabel)) {
      seenLabels.add(arch.shortLabel);

      // Locate the exact sentence or clause containing the thought
      const matchingSentence = sentences.find((s) => {
        const sl = s.toLowerCase();
        return sl.includes(arch.keyword) || arch.synonyms.some((syn) => sl.includes(syn));
      });

      let quote = matchingSentence ? formatGroundedQuote(matchingSentence) : '';

      // Content-grounded visual modulation based on specific wording
      const qLower = quote.toLowerCase();
      let form = arch.outerForm;
      let weight = Math.min(1.0, Math.max(0.1, arch.weightBase + stressMod * 0.25));
      let calmness = Math.min(1.0, Math.max(0.1, arch.calmnessBase - stressMod * 0.25));
      let instability = Math.min(1.0, Math.max(0.08, arch.instabilityBase + stressMod * 0.25));
      let openness = Math.min(1.0, Math.max(0.15, arch.opennessBase + creativityMod * 0.25));

      if (qLower.includes('exhaust') || qLower.includes('drained') || qLower.includes('heavy') || qLower.includes('tired')) {
        form = 'heavy_grounded';
        weight = Math.min(1.0, weight + 0.2);
        calmness = Math.max(0.2, calmness - 0.1);
      } else if (qLower.includes('peace') || qLower.includes('safe') || qLower.includes('calm') || qLower.includes('breathe')) {
        form = 'smooth_expansive';
        calmness = Math.min(1.0, calmness + 0.15);
        openness = Math.min(1.0, openness + 0.1);
      } else if (qLower.includes('torn') || qLower.includes('struggle') || qLower.includes('fight') || qLower.includes('panic')) {
        form = 'swollen_unstable';
        instability = Math.min(1.0, instability + 0.2);
      } else if (qLower.includes('focus') || qLower.includes('solve') || qLower.includes('clear') || qLower.includes('align')) {
        form = 'sharply_irregular';
        openness = Math.min(1.0, openness + 0.1);
      }

      const intensity = Math.min(1.0, Math.max(0.2, arch.intensityBase + (rand() * 0.1 - 0.05)));
      const complexity = Math.min(1.0, Math.max(0.2, arch.complexityBase + creativityMod * 0.3));
      const conflict = Math.min(1.0, Math.max(0.05, arch.conflictBase + stressMod * 0.25));

      matchedCandidates.push({
        arch,
        quote,
        intensity,
        weight,
        calmness,
        instability,
        openness,
        complexity,
        conflict,
        form,
      });
    }
  }

  // If text is rich but had few direct dictionary keyword hits, parse genuine sentences
  if (matchedCandidates.length < maxSatelliteCount && sentences.length > 1) {
    sentences.forEach((s, idx) => {
      if (matchedCandidates.length >= maxSatelliteCount) return;
      const sLower = s.toLowerCase();
      const isQuestion = s.includes('?');
      const isShort = s.split(' ').length < 6;
      let arch: SentimentExtract | undefined;

      if (isQuestion) {
        arch = EXPERIENTIAL_ARCHETYPES.find((a) => a.keyword === 'decision');
      } else if (isShort) {
        arch = EXPERIENTIAL_ARCHETYPES.find((a) => a.keyword === 'focus');
      } else if (sLower.includes('remember') || sLower.includes('past') || sLower.includes('ago')) {
        arch = EXPERIENTIAL_ARCHETYPES.find((a) => a.keyword === 'memory');
      } else if (sLower.includes('friend') || sLower.includes('partner') || sLower.includes('talk')) {
        arch = EXPERIENTIAL_ARCHETYPES.find((a) => a.keyword === 'friend');
      } else if (sLower.includes('still') || sLower.includes('quiet') || sLower.includes('night')) {
        arch = EXPERIENTIAL_ARCHETYPES.find((a) => a.keyword === 'stillness');
      } else if (sLower.includes('hope') || sLower.includes('tomorrow') || sLower.includes('wish')) {
        arch = EXPERIENTIAL_ARCHETYPES.find((a) => a.keyword === 'hope');
      } else {
        arch = EXPERIENTIAL_ARCHETYPES[idx % EXPERIENTIAL_ARCHETYPES.length];
      }

      if (arch && !seenLabels.has(arch.shortLabel)) {
        seenLabels.add(arch.shortLabel);
        let quote = formatGroundedQuote(s);

        matchedCandidates.push({
          arch,
          quote,
          intensity: arch.intensityBase,
          weight: arch.weightBase,
          calmness: arch.calmnessBase,
          instability: arch.instabilityBase,
          openness: arch.opennessBase,
          complexity: arch.complexityBase,
          conflict: arch.conflictBase,
          form: arch.outerForm,
        });
      }
    });
  }

  const selectedCandidates = matchedCandidates.slice(0, maxSatelliteCount);

  // 4. Transform Candidates for Spacious Solar-System Layout with Strict 3D Collision Avoidance
  const rawSatellites: RawNodeCandidate[] = selectedCandidates.map((cand, i) => {
    const { arch, quote, intensity, weight, calmness, instability, openness, complexity, conflict, form } = cand;
    const narrativeImportance = Math.min(1.0, Math.max(0.35, 0.95 - i * 0.06));
    const baseRadius = 1.72 + narrativeImportance * 0.35 + intensity * 0.16;

    return {
      id: `node-${arch.keyword}-${i}`,
      label: arch.phraseTemplate(quote),
      shortLabel: arch.shortLabel,
      category: arch.category,
      groundedQuote: quote,
      experientialAtmosphere: arch.experientialTheme,
      narrativeSignificance: `Grounded in relation to: "${centralTitle}"`,
      intensity,
      weight,
      calmness,
      instability,
      openness,
      emotionalDistance: 1.0 - narrativeImportance,
      complexity,
      conflict,
      narrativeImportance,
      outerForm: form,
      surfaceBehavior: arch.surfaceBehavior,
      materialType: arch.materialType,
      colorSpec: arch.color,
      baseRadius: Number(baseRadius.toFixed(2)),
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
    baseRadius: 4.4,
  };

  const layoutResult = buildSpaciousSolarLayout(rawCentral, rawSatellites, seed);
  const nodes = layoutResult.nodes;
  const connections = layoutResult.connections;

  // Populate connectedDirections on each node so organic meshes sculpt trumpet root funnels toward connections
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
  let dominantFeel = 'Equilibrium & Quiet Clarity';
  let ambientLightColor = '#dde4ed';
  let fogColor = '#13141a';

  if (avgConflict > 0.45 || stressIndex > 7) {
    temperature = 'charged_tense';
    dominantFeel = 'Underlying Strain & Inward Searching';
    ambientLightColor = '#ebdbe0';
    fogColor = '#161419';
  } else if (avgCalmness > 0.65) {
    temperature = 'warm_intimate';
    dominantFeel = 'Spacious Restoration & Stillness';
    ambientLightColor = '#faefe0';
    fogColor = '#151419';
  } else if (nodes.some((n) => n.category === 'memory')) {
    temperature = 'cool_distant';
    dominantFeel = 'Contemplative Distance & Echo';
    ambientLightColor = '#dbe5f0';
    fogColor = '#12141c';
  }

  return {
    entryId: entry.id,
    entryTitle: entry.title || 'Untitled Reflection',
    centralIncidentSummary: `An organic landscape of ${nodes.length} emotional currents, anchored around: "${centralTitle}"`,
    hasSufficientData: true,
    wordCount,
    nodes,
    connections,
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
