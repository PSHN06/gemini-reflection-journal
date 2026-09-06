export type NodeCategory =
  | 'central_incident'
  | 'emotion'
  | 'thought'
  | 'memory'
  | 'relationship'
  | 'conflict'
  | 'comfort'
  | 'pressure';

export type OuterFormType =
  | 'rounded_open'
  | 'compressed_dense'
  | 'stretched_distant'
  | 'folded_inward'
  | 'swollen_unstable'
  | 'fragmented_connected'
  | 'smooth_expansive'
  | 'sharply_irregular'
  | 'delicate_translucent'
  | 'heavy_grounded';

export type SurfaceBehaviorType =
  | 'slow_smooth'
  | 'racing_thoughts'
  | 'opposing_currents'
  | 'inward_folding'
  | 'expansion_release'
  | 'layered_misaligned'
  | 'faded_edges'
  | 'energetic_coherent';

export type MaterialType =
  | 'soft_gel'
  | 'cloudy_glass'
  | 'dense_liquid'
  | 'mist_volume'
  | 'organic_membrane'
  | 'mineral_layer'
  | 'translucent_fluid'
  | 'glowing_tissue';

export interface EmotionalColorSpec {
  baseColor: string;      // Subtle primary tint
  innerGlowColor: string; // Internal filament / core warmth
  rimColor: string;       // Delicate Fresnel edge highlight
  attenuationColor: string;
  roughness: number;      // 0.1 to 0.8
  metalness: number;      // usually 0.05 to 0.2 (never metallic)
  transmission: number;   // 0.4 to 0.95
  opacity: number;        // 0.35 to 0.92
}

export interface AggregateNodeMeta {
  entryCount: number;
  totalEntriesInPeriod: number;
  frequencyPercentage: number;
  representativeQuotes: {
    quote: string;
    entryTitle: string;
    dateStr: string;
    entryId: string;
  }[];
  relatedConcepts: string[];
}

export interface LandscapeNode {
  id: string;
  label: string; // Evocative phrase (e.g., "Quiet relief after hours of tension")
  shortLabel: string; // Concise anchor (e.g., "Quiet Relief")
  category: NodeCategory;
  groundedQuote: string; // Verbatim snippet from user's entry
  experientialAtmosphere: string; // How this feeling manifested in this specific story
  narrativeSignificance: string; // Why this matter to the incident

  // Interpretation parameters (0.0 to 1.0)
  intensity: number;          // Scale, saturation, internal activity
  weight: number;             // Density, darkness, gravitational Y offset
  calmness: number;           // Smoothness, transparency, slower movement
  instability: number;        // Surface deformation, irregular motion
  openness: number;           // Expansion, negative space, translucency
  emotionalDistance: number;  // Opacity, separation, radial spread
  complexity: number;         // Internal layers, folds, filaments
  conflict: number;           // Opposing currents, tension
  narrativeImportance: number;// Prominence, visual radius

  // Visual parameters
  outerForm: OuterFormType;
  surfaceBehavior: SurfaceBehaviorType;
  materialType: MaterialType;
  colorSpec: EmotionalColorSpec;
  
  // 3D coordinates
  position: [number, number, number];
  baseRadius: number; // typically 1.2 to 3.8
  connectedDirections?: [number, number, number][]; // Directions of neural cords connecting to this node
  entryDate?: string;
  aggregateMeta?: AggregateNodeMeta;
}

export interface LandscapeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: 
    | 'anchors'
    | 'conflicts_with'
    | 'emerged_from'
    | 'resonates_with'
    | 'comforts'
    | 'weights_down'
    | 'clarifies';
  resonanceExplanation: string; // Answers: "Why are these two experiences connected in this entry?"
  strength: number; // 0.1 to 1.0 -> determines strand thickness & visual energy
  tension: number;  // 0.0 to 1.0 -> determines curvature resistance / jitter
}

export interface EmotionalLandscapeData {
  entryId: string;
  entryTitle: string;
  centralIncidentSummary: string;
  hasSufficientData: boolean;
  wordCount: number;
  nodes: LandscapeNode[];
  connections: LandscapeConnection[];
  mode?: 'entry' | 'patterns';
  timePeriod?: 'daily' | 'weekly' | 'monthly';
  periodLabel?: string;
  periodDateRange?: string;
  entryCountInPeriod?: number;
  emptyReason?: 'no_entry_selected' | 'no_entries_in_period' | 'insufficient_patterns';
  globalAtmosphere: {
    dominantFeel: string;
    temperature: 'warm_intimate' | 'cool_distant' | 'neutral_still' | 'charged_tense';
    ambientLightColor: string;
    fogColor: string;
    fogDensity: number;
  };
  telemetryModulation: {
    stressDampening: number;
    focusClarity: number;
    creativityBranching: number;
  };
}
