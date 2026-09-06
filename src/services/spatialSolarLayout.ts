import { LandscapeNode, LandscapeConnection } from '../types/landscape';
import { createSeededRandom } from './emotionalLandscapeEngine';

export interface RawNodeCandidate {
  id: string;
  label: string;
  shortLabel: string;
  category: LandscapeNode['category'];
  groundedQuote: string;
  experientialAtmosphere: string;
  narrativeSignificance: string;
  intensity: number;
  weight: number;
  calmness: number;
  instability: number;
  openness: number;
  emotionalDistance: number;
  complexity: number;
  conflict: number;
  narrativeImportance: number;
  outerForm: LandscapeNode['outerForm'];
  surfaceBehavior: LandscapeNode['surfaceBehavior'];
  materialType: LandscapeNode['materialType'];
  colorSpec: LandscapeNode['colorSpec'];
  baseRadius: number;
  frequencyPercent?: number;
  entryCount?: number;
  crossReflectionQuotes?: any[];
  coOccurringConcepts?: string[];
  aggregateMeta?: LandscapeNode['aggregateMeta'];
}

export interface SolarLayoutResult {
  nodes: LandscapeNode[];
  connections: LandscapeConnection[];
}

/**
 * Calculates collision radius accounting for:
 * 1. Physical 3D organic mesh radius
 * 2. Visual glow/bloom envelope
 * 3. 3D projection footprint of title and quotation
 * 4. Generous Apple-level readability margin
 */
export function calculateCollisionRadius(
  baseRadius: number,
  shortLabel: string,
  groundedQuote?: string,
  isCentral: boolean = false
): number {
  if (isCentral) {
    // Central anchor sun needs protected breathing room
    return baseRadius + 3.8;
  }

  // Clearance in 3D world units ensuring at least 2 to 3 node-widths of space
  return baseRadius * 1.45 + 1.8;
}

/**
 * Arranges nodes in a spacious, 3D solar system constellation:
 * - Central node acts as the emotional sun at [0, 0, 0]
 * - Primary nodes orbit in an inner band with generous spacing
 * - Secondary nodes orbit in a mid band
 * - Tertiary / peripheral nodes orbit in an outer band
 * - Strict 3D collision avoidance with iterative relaxation
 * - Clean, sparse neural connections without spiderweb tangles
 */
export function buildSpaciousSolarLayout(
  centralNodeData: RawNodeCandidate,
  satelliteCandidates: RawNodeCandidate[],
  seed: number,
  categoryAffinityMap?: Map<string, string[]>
): SolarLayoutResult {
  const rand = createSeededRandom(seed);
  const totalSatellites = satelliteCandidates.length;

  // 1. Sort satellite candidates by narrative importance / frequency descending
  const sortedSatellites = [...satelliteCandidates].sort(
    (a, b) => b.narrativeImportance - a.narrativeImportance
  );

  // 2. Partition into hierarchical orbital bands based on node count and importance
  // Band 1: Near orbit (Primary related nodes)
  // Band 2: Mid orbit (Secondary related nodes)
  // Band 3: Outer orbit (Tertiary / weakly related nodes)
  interface PositionedNode {
    candidate: RawNodeCandidate;
    bandIndex: 0 | 1 | 2; // 0 = inner, 1 = mid, 2 = outer
    targetRadius: number;
    position: [number, number, number];
    collisionRadius: number;
    baseRadius: number;
  }

  const positionedNodes: PositionedNode[] = [];

  // Central Sun Node
  const centralBaseRadius = 3.5;
  const centralCollisionRadius = calculateCollisionRadius(
    centralBaseRadius,
    centralNodeData.shortLabel,
    centralNodeData.groundedQuote,
    true
  );

  // Distribute satellites into orbital bands
  // Balanced solar system radii:
  // Band 1 (Inner): ~10.2 to 11.5 units
  // Band 2 (Mid): ~15.2 to 16.5 units
  // Band 3 (Outer): ~20.5 to 21.5 units
  const band1Radius = totalSatellites <= 3 ? 10.0 : totalSatellites <= 6 ? 11.0 : 11.8;
  const band2Radius = totalSatellites <= 6 ? 15.2 : 16.5;
  const band3Radius = 20.8;

  let band1Count = 0;
  let band2Count = 0;
  let band3Count = 0;

  if (totalSatellites <= 4) {
    band1Count = totalSatellites;
  } else if (totalSatellites <= 7) {
    band1Count = Math.min(4, Math.ceil(totalSatellites * 0.5));
    band2Count = totalSatellites - band1Count;
  } else {
    band1Count = 4;
    band2Count = Math.min(5, Math.ceil((totalSatellites - 4) * 0.6));
    band3Count = totalSatellites - band1Count - band2Count;
  }

  // Category angular affinity map to cluster related emotions together in 3D space
  const categoryBaseAngles: Record<string, number> = {
    comfort: 0.25,    // East quadrant
    emotion: 1.35,    // North-East quadrant
    thought: 2.65,    // North-West quadrant
    pressure: 3.95,   // South-West quadrant
    conflict: 5.15,   // South-East quadrant
  };

  const getCategoryAngle = (cat: string): number => {
    return categoryBaseAngles[cat] ?? 1.57;
  };

  // Sort nodes within a band to cluster semantically
  const sortBandByAffinity = (bandList: RawNodeCandidate[]) => {
    return [...bandList].sort((a, b) => getCategoryAngle(a.category) - getCategoryAngle(b.category));
  };

  // Process Band 1 (Inner Orbit - Primary Nodes)
  const band1Nodes = sortBandByAffinity(sortedSatellites.slice(0, band1Count));
  band1Nodes.forEach((cand, i) => {
    // Sizing: Primary nodes are substantial and crystalline
    const baseRadius = 2.1 + cand.narrativeImportance * 0.38;
    const colRadius = calculateCollisionRadius(
      baseRadius,
      cand.shortLabel,
      cand.groundedQuote,
      false
    );

    // Target azimuth blends category affinity angle with step distribution
    const stepAngle = (i / Math.max(1, band1Count)) * (Math.PI * 2);
    const catAngle = getCategoryAngle(cand.category);
    const theta = (catAngle * 0.55 + stepAngle * 0.45) + (rand() * 0.12 - 0.06);

    // Staggered vertical elevation: alternate positive and negative height
    const elevationSign = i % 2 === 0 ? 1 : -1;
    const elevationAngle = elevationSign * (0.24 + (i % 3) * 0.08); // ~14 to 22 degrees
    const r = band1Radius + (rand() * 1.4 - 0.7);

    const x = r * Math.cos(theta) * Math.cos(elevationAngle);
    const y = r * Math.sin(elevationAngle) * 0.85;
    const z = r * Math.sin(theta) * Math.cos(elevationAngle);

    positionedNodes.push({
      candidate: cand,
      bandIndex: 0,
      targetRadius: band1Radius,
      position: [x, y, z],
      collisionRadius: colRadius,
      baseRadius,
    });
  });

  // Process Band 2 (Mid Orbit - Secondary Nodes)
  const band2Nodes = sortBandByAffinity(sortedSatellites.slice(band1Count, band1Count + band2Count));
  band2Nodes.forEach((cand, i) => {
    const baseRadius = 1.65 + cand.narrativeImportance * 0.32;
    const colRadius = calculateCollisionRadius(
      baseRadius,
      cand.shortLabel,
      cand.groundedQuote,
      false
    );

    // Offset azimuth relative to Band 1 so nodes do not align radially
    const stepAngle = ((i + 0.5) / Math.max(1, band2Count)) * (Math.PI * 2);
    const catAngle = getCategoryAngle(cand.category);
    const theta = (catAngle * 0.55 + stepAngle * 0.45) + (rand() * 0.14 - 0.07);

    // Varied vertical inclination
    const elevationSign = (i + 1) % 2 === 0 ? 1 : -1;
    const elevationAngle = elevationSign * (0.28 + (i % 2) * 0.10); // ~16 to 22 degrees
    const r = band2Radius + (rand() * 1.8 - 0.9);

    const x = r * Math.cos(theta) * Math.cos(elevationAngle);
    const y = r * Math.sin(elevationAngle) * 0.88;
    const z = r * Math.sin(theta) * Math.cos(elevationAngle);

    positionedNodes.push({
      candidate: cand,
      bandIndex: 1,
      targetRadius: band2Radius,
      position: [x, y, z],
      collisionRadius: colRadius,
      baseRadius,
    });
  });

  // Process Band 3 (Outer Orbit - Tertiary Nodes)
  const band3Nodes = sortBandByAffinity(sortedSatellites.slice(band1Count + band2Count));
  band3Nodes.forEach((cand, i) => {
    const baseRadius = 1.32 + cand.narrativeImportance * 0.22;
    const colRadius = calculateCollisionRadius(
      baseRadius,
      cand.shortLabel,
      cand.groundedQuote,
      false
    );

    const stepAngle = ((i + 0.25) / Math.max(1, band3Count)) * (Math.PI * 2);
    const catAngle = getCategoryAngle(cand.category);
    const theta = (catAngle * 0.55 + stepAngle * 0.45) + (rand() * 0.15 - 0.075);

    const elevationSign = i % 2 === 0 ? -1 : 1;
    const elevationAngle = elevationSign * (0.30 + (i % 2) * 0.10);
    const r = band3Radius + (rand() * 2.0 - 1.0);

    const x = r * Math.cos(theta) * Math.cos(elevationAngle);
    const y = r * Math.sin(elevationAngle) * 0.9;
    const z = r * Math.sin(theta) * Math.cos(elevationAngle);

    positionedNodes.push({
      candidate: cand,
      bandIndex: 2,
      targetRadius: band3Radius,
      position: [x, y, z],
      collisionRadius: colRadius,
      baseRadius,
    });
  });

  // 3. Strict 3D Collision Relaxation Iterations
  // Multiple passes pushing overlapping nodes apart in 3D while preserving orbital hierarchy
  const relaxationIterations = 65;

  for (let iter = 0; iter < relaxationIterations; iter++) {
    const damping = Math.max(0.2, 1.0 - (iter / relaxationIterations) * 0.7);

    // A. Central Exclusion: No node may violate the central sun's gravitational corridor
    for (let i = 0; i < positionedNodes.length; i++) {
      const node = positionedNodes[i];
      const distFromCenter = Math.hypot(node.position[0], node.position[1], node.position[2]);
      const minFromCenter = centralCollisionRadius + node.collisionRadius * 0.75;

      if (distFromCenter < minFromCenter) {
        const pushMag = (minFromCenter - distFromCenter) * damping;
        const normX = distFromCenter > 0.001 ? node.position[0] / distFromCenter : 1;
        const normY = distFromCenter > 0.001 ? node.position[1] / distFromCenter : 0.2;
        const normZ = distFromCenter > 0.001 ? node.position[2] / distFromCenter : 0;

        node.position[0] += normX * pushMag;
        node.position[1] += normY * pushMag;
        node.position[2] += normZ * pushMag;
      }
    }

    // B. Pairwise Repulsion between Satellite Nodes
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const nodeA = positionedNodes[i];
        const nodeB = positionedNodes[j];

        const dx = nodeB.position[0] - nodeA.position[0];
        const dy = nodeB.position[1] - nodeA.position[1];
        const dz = nodeB.position[2] - nodeA.position[2];
        const dist = Math.hypot(dx, dy, dz);

        const requiredMinDist = nodeA.collisionRadius + nodeB.collisionRadius;

        if (dist < requiredMinDist) {
          const overlap = requiredMinDist - dist;
          const separationForce = (overlap * 0.5 * damping) / Math.max(dist, 0.01);

          const pushX = dx * separationForce;
          const pushY = dy * separationForce;
          const pushZ = dz * separationForce;

          // Push apart symmetrically
          nodeA.position[0] -= pushX;
          nodeA.position[1] -= pushY;
          nodeA.position[2] -= pushZ;

          nodeB.position[0] += pushX;
          nodeB.position[1] += pushY;
          nodeB.position[2] += pushZ;
        }
      }
    }

    // C. Orbital Band Gentle Restoration Spring
    // Keeps nodes from drifting infinitely away from their assigned planetary bands
    for (let i = 0; i < positionedNodes.length; i++) {
      const node = positionedNodes[i];
      const curR = Math.hypot(node.position[0], node.position[1], node.position[2]);
      const deltaR = curR - node.targetRadius;

      if (Math.abs(deltaR) > 1.8) {
        const restoreForce = deltaR * 0.08 * damping;
        const normX = node.position[0] / curR;
        const normY = node.position[1] / curR;
        const normZ = node.position[2] / curR;

        node.position[0] -= normX * restoreForce;
        node.position[1] -= normY * restoreForce;
        node.position[2] -= normZ * restoreForce;
      }

      // Vertical separation preservation (prevent collapse into a flat 2D plate)
      if (Math.abs(node.position[1]) < 1.2) {
        node.position[1] += (node.position[1] >= 0 ? 1 : -1) * 0.4 * damping;
      }
    }
  }

  // 4. Construct Final Landscape Nodes
  const finalNodes: LandscapeNode[] = [];

  // Add Central Sun Node
  finalNodes.push({
    ...centralNodeData,
    position: [0, 0, 0],
    baseRadius: Number(centralBaseRadius.toFixed(2)),
  });

  // Add Satellite Nodes with rounded positions
  positionedNodes.forEach((pn) => {
    finalNodes.push({
      ...pn.candidate,
      position: [
        Number(pn.position[0].toFixed(2)),
        Number(pn.position[1].toFixed(2)),
        Number(pn.position[2].toFixed(2)),
      ],
      baseRadius: Number(pn.baseRadius.toFixed(2)),
    });
  });

  // 5. Build Elegant, Sparse Neural Connections
  // Rules for clean, spacious connections:
  // - Central sun connects to ALL Band 1 (Primary) nodes
  // - Central sun connects to strong Band 2 nodes (strength >= 0.6)
  // - Tertiary nodes connect to their nearest parent theme (NOT the central sun)
  // - Meaningful cross-connections only between resonant/co-occurring concepts
  // - Avoid crossing through the central zone
  const connections: LandscapeConnection[] = [];
  const centralId = centralNodeData.id;

  const primaryNodes = positionedNodes.filter((p) => p.bandIndex === 0);
  const secondaryNodes = positionedNodes.filter((p) => p.bandIndex === 1);
  const tertiaryNodes = positionedNodes.filter((p) => p.bandIndex === 2);

  // A. Central to Primary Nodes (Core solar rays)
  primaryNodes.forEach((pn) => {
    connections.push({
      id: `conn-central-${pn.candidate.id}`,
      sourceId: centralId,
      targetId: pn.candidate.id,
      strength: Math.min(1.0, 0.75 + pn.candidate.narrativeImportance * 0.25),
      tension: 0.16,
      relationshipType: 'anchors',
      resonanceExplanation: `Primary inner orbit resonance anchoring ${pn.candidate.shortLabel} directly to the central emotional core.`,
    });
  });

  // B. Central to Secondary Nodes (Select significant rays)
  secondaryNodes.forEach((pn, i) => {
    // Only connect if moderately high importance to avoid dense spoke clutter
    if (pn.candidate.narrativeImportance > 0.45 || i < 3) {
      connections.push({
        id: `conn-central-${pn.candidate.id}`,
        sourceId: centralId,
        targetId: pn.candidate.id,
        strength: Math.min(0.85, 0.5 + pn.candidate.narrativeImportance * 0.2),
        tension: 0.22,
        relationshipType: 'resonates_with',
        resonanceExplanation: `Secondary planetary connection linking ${pn.candidate.shortLabel} with the central narrative core.`,
      });
    }
  });

  // C. Tertiary Nodes: Connect to nearest parent theme in Band 1 or Band 2 (Constellation clustering)
  tertiaryNodes.forEach((tn) => {
    // Find closest node in Band 1 or Band 2
    let nearestParent = primaryNodes[0] || secondaryNodes[0];
    let minDist = Infinity;

    [...primaryNodes, ...secondaryNodes].forEach((parent) => {
      const d = Math.hypot(
        parent.position[0] - tn.position[0],
        parent.position[1] - tn.position[1],
        parent.position[2] - tn.position[2]
      );
      // Prefer same category if within reasonable distance
      const categoryBonus = parent.candidate.category === tn.candidate.category ? 0.7 : 1.0;
      const effectiveDist = d * categoryBonus;

      if (effectiveDist < minDist) {
        minDist = effectiveDist;
        nearestParent = parent;
      }
    });

    if (nearestParent) {
      connections.push({
        id: `conn-sub-${nearestParent.candidate.id}-${tn.candidate.id}`,
        sourceId: nearestParent.candidate.id,
        targetId: tn.candidate.id,
        strength: 0.48,
        tension: 0.28,
        relationshipType: 'emerged_from',
        resonanceExplanation: `Outer tributary concept branching outwards from ${nearestParent.candidate.shortLabel} into deeper reflection nuances.`,
      });
    }
  });

  // D. Sparse Inter-Satellite Resonant Links (Meaningful semantic & co-occurrence relationships)
  // Strict rule: at most 1 or 2 cross-links per satellite, and MUST NOT pass through origin
  const connectedPairs = new Set<string>();

  for (let i = 0; i < positionedNodes.length; i++) {
    for (let j = i + 1; j < positionedNodes.length; j++) {
      if (connections.length >= totalSatellites + 6) break;

      const nodeA = positionedNodes[i];
      const nodeB = positionedNodes[j];

      // Check co-occurrence or category resonance
      const hasExplicitCoOccurrence = (nodeA.candidate.coOccurringConcepts || []).includes(
        nodeB.candidate.shortLabel
      );
      const sameCategory = nodeA.candidate.category === nodeB.candidate.category;

      if (hasExplicitCoOccurrence || sameCategory) {
        const pairKey = [nodeA.candidate.id, nodeB.candidate.id].sort().join('::');
        if (connectedPairs.has(pairKey)) continue;

        // Check if line segment passes too close to origin (0, 0, 0)
        // Midpoint check
        const midX = (nodeA.position[0] + nodeB.position[0]) / 2;
        const midY = (nodeA.position[1] + nodeB.position[1]) / 2;
        const midZ = (nodeA.position[2] + nodeB.position[2]) / 2;
        const midDist = Math.hypot(midX, midY, midZ);

        // If line cuts through central sun (< 5.5 units), skip it to avoid crossing through central sun!
        if (midDist < 5.5) continue;

        // 3D Distance check: don't draw crazy long lines across the universe
        const dist = Math.hypot(
          nodeB.position[0] - nodeA.position[0],
          nodeB.position[1] - nodeA.position[1],
          nodeB.position[2] - nodeA.position[2]
        );

        if (dist < 42.0) {
          connectedPairs.add(pairKey);

          let relType: LandscapeConnection['relationshipType'] = 'resonates_with';
          if (
            (nodeA.candidate.category === 'pressure' && nodeB.candidate.category === 'comfort') ||
            (nodeA.candidate.category === 'comfort' && nodeB.candidate.category === 'pressure')
          ) {
            relType = 'comforts';
          } else if (
            (nodeA.candidate.category === 'conflict' || nodeB.candidate.category === 'conflict')
          ) {
            relType = 'conflicts_with';
          }

          connections.push({
            id: `conn-cross-${nodeA.candidate.id}-${nodeB.candidate.id}`,
            sourceId: nodeA.candidate.id,
            targetId: nodeB.candidate.id,
            strength: hasExplicitCoOccurrence ? 0.65 : 0.42,
            tension: 0.32,
            relationshipType: relType,
            resonanceExplanation: `Lateral resonance connecting ${nodeA.candidate.shortLabel} with ${nodeB.candidate.shortLabel}.`,
          });
        }
      }
    }
  }

  return {
    nodes: finalNodes,
    connections,
  };
}
