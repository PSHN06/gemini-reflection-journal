import * as THREE from 'three';
import { LandscapeConnection, LandscapeNode } from '../../types/landscape';

export interface ConnectionMeshBundle {
  mesh: THREE.Mesh;
  connectionData: LandscapeConnection;
  updateAnimation: (time: number, isReducedMotion: boolean, isSourceOrTargetSelected: boolean) => void;
  dispose: () => void;
}

/**
 * Creates an organic, translucent living strand connecting two emotional experiences.
 * Clearly visible in overview; gently illuminates with warm/cool resonance when inspecting connected feelings.
 */
export function createConnectionRibbonMesh(
  conn: LandscapeConnection,
  sourceNode: LandscapeNode,
  targetNode: LandscapeNode
): ConnectionMeshBundle {
  const pA = new THREE.Vector3(...sourceNode.position);
  const pB = new THREE.Vector3(...targetNode.position);

  // Calculate an organic arched midpoint
  const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const len = dir.length();

  // Gentle organic sag or lift
  let yBias = 0.25;
  if (conn.relationshipType === 'conflicts_with') {
    yBias = -0.35; // subtle downward gravitational tension
  } else if (conn.relationshipType === 'comforts') {
    yBias = 0.45; // gentle uplifting arc
  }

  mid.y += yBias * (len * 0.12);
  mid.x += Math.sin(sourceNode.position[0] * 0.7) * 0.35;

  const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);

  // Clear, readable strand thickness: 0.07 to 0.11 (visible living filament)
  const tubeRadius = 0.065 + conn.strength * 0.035;
  const tubeGeom = new THREE.TubeGeometry(curve, 36, tubeRadius, 8, false);

  // Sophisticated, harmonious palette
  let strandColorHex = '#88a2b8'; // soft slate blue (anchors / resonance)
  if (conn.relationshipType === 'conflicts_with') {
    strandColorHex = '#b57c85'; // desaturated rose clay
  } else if (conn.relationshipType === 'comforts') {
    strandColorHex = '#c4ab89'; // warm soft amber
  } else if (conn.relationshipType === 'clarifies' || conn.relationshipType === 'resonates_with') {
    strandColorHex = '#8ea394'; // sage mist
  }

  const strandColor = new THREE.Color(strandColorHex);
  const baseOpacity = 0.42 + conn.strength * 0.12;

  const tubeMat = new THREE.MeshStandardMaterial({
    color: strandColor,
    roughness: 0.32,
    metalness: 0.0,
    transparent: true,
    opacity: baseOpacity,
    emissive: strandColor,
    emissiveIntensity: 0.18,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(tubeGeom, tubeMat);
  (mesh as any).connectionData = conn;

  const updateAnimation = (time: number, isReducedMotion: boolean, isSourceOrTargetSelected: boolean) => {
    if (isSourceOrTargetSelected) {
      // Glow brightly when either connected node is focused
      const pulse = isReducedMotion ? 0 : Math.sin(time * 2.0) * 0.08;
      tubeMat.opacity = Math.min(0.9, 0.75 + pulse);
      tubeMat.emissiveIntensity = 0.55 + (isReducedMotion ? 0 : Math.sin(time * 2.0) * 0.15);
    } else if (!isReducedMotion) {
      // Calm living respiration
      tubeMat.opacity = baseOpacity + Math.sin(time * 0.8 + len) * 0.05;
      tubeMat.emissiveIntensity = 0.18 + Math.sin(time * 0.8 + len) * 0.04;
    } else {
      tubeMat.opacity = baseOpacity;
      tubeMat.emissiveIntensity = 0.18;
    }
  };

  const dispose = () => {
    tubeGeom.dispose();
    tubeMat.dispose();
  };

  return {
    mesh,
    connectionData: conn,
    updateAnimation,
    dispose,
  };
}
