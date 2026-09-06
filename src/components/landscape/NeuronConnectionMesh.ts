import * as THREE from 'three';
import { LandscapeConnection, LandscapeNode } from '../../types/landscape';

export interface NeuronMeshBundle {
  group: THREE.Group;
  connectionData: LandscapeConnection;
  updateAnimation: (time: number, isReducedMotion: boolean, isConnectedToSelected: boolean) => void;
  dispose: () => void;
}

interface SparkState {
  curve: THREE.Curve<THREE.Vector3>;
  speed: number;
  phase: number;
  direction: 1 | -1;
  leadMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  trail1Mesh: THREE.Mesh;
  trail2Mesh: THREE.Mesh;
  coreMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
  trail1Mat: THREE.MeshBasicMaterial;
  trail2Mat: THREE.MeshBasicMaterial;
}

/**
 * Creates radiant, biological neural filaments connecting emotional experiences.
 * Matches the reference art's branching dendritic roots, luminous braided sinews,
 * and incandescent traveling sparks.
 */
export function createNeuronConnectionMesh(
  conn: LandscapeConnection,
  sourceNode: LandscapeNode,
  targetNode: LandscapeNode
): NeuronMeshBundle {
  const group = new THREE.Group();
  group.name = `neuron-conn-${conn.id}`;

  const pA = new THREE.Vector3(...sourceNode.position);
  const pB = new THREE.Vector3(...targetNode.position);

  const delta = new THREE.Vector3().subVectors(pB, pA);
  const length = delta.length();
  const dir = delta.clone().normalize();

  // Find two stable perpendicular axes for 3D fanning and braiding
  const upCandidate = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const sideVec = new THREE.Vector3().crossVectors(dir, upCandidate).normalize();
  const perpVec = new THREE.Vector3().crossVectors(dir, sideVec).normalize();

  // Organic arching and lateral sway
  let ySag = 0.18;
  let xWiggle = Math.sin(sourceNode.position[0] * 1.5 + targetNode.position[2] * 1.1) * 0.32;

  if (conn.relationshipType === 'conflicts_with') {
    ySag = -0.28;
    xWiggle *= 1.3;
  } else if (conn.relationshipType === 'comforts') {
    ySag = 0.32;
  } else if (conn.relationshipType === 'clarifies') {
    ySag = 0.12;
  }

  // Luminous golden/amber/warm ivory color palette matching reference
  let strandColorHex = '#c49a58'; // muted warm golden bronze
  let sparkColorHex = '#fff4dc';  // soft incandescent warm ivory

  if (conn.relationshipType === 'conflicts_with') {
    strandColorHex = '#9d636b'; // soft muted rose
    sparkColorHex = '#ffebee';
  } else if (conn.relationshipType === 'comforts') {
    strandColorHex = '#bfa168'; // soft radiant honey
    sparkColorHex = '#fffaf0';
  } else if (conn.relationshipType === 'clarifies' || conn.relationshipType === 'resonates_with') {
    strandColorHex = '#7a9e92'; // sage mist
    sparkColorHex = '#f0fdf4';
  }

  const strandColor = new THREE.Color(strandColorHex);

  // Delicate translucent biological filament material
  const baseFilamentOpacity = 0.26 + conn.strength * 0.14;
  const filamentMaterial = new THREE.MeshStandardMaterial({
    color: strandColor,
    roughness: 0.42,
    metalness: 0.02,
    transparent: true,
    opacity: baseFilamentOpacity,
    emissive: strandColor,
    emissiveIntensity: 0.22,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const filamentGeometries: THREE.BufferGeometry[] = [];
  const filamentMeshes: THREE.Mesh[] = [];
  const curves: THREE.Curve<THREE.Vector3>[] = [];

  // Attachment radii on node surfaces
  const rA = sourceNode.baseRadius * 0.92;
  const rB = targetNode.baseRadius * 0.88;

  // 1. Central Axon Core (The main structural spine)
  const ctrlA = pA.clone().addScaledVector(dir, length * 0.28).addScaledVector(perpVec, ySag * length * 0.08);
  const ctrlB = pB.clone().addScaledVector(dir, -length * 0.28).addScaledVector(sideVec, xWiggle * length * 0.06);
  const mainCurve = new THREE.CubicBezierCurve3(pA, ctrlA, ctrlB, pB);
  curves.push(mainCurve);

  const mainRadius = 0.014 + conn.strength * 0.007;
  const mainGeom = new THREE.TubeGeometry(mainCurve, 48, mainRadius, 8, false);
  filamentGeometries.push(mainGeom);
  const mainMesh = new THREE.Mesh(mainGeom, filamentMaterial);
  group.add(mainMesh);
  filamentMeshes.push(mainMesh);

  // 2. Dendritic Root Web 1: Upper Root fanning across Source Membrane -> braiding to midspan -> Target
  const rootA1 = pA.clone().addScaledVector(sideVec, rA * 0.65).addScaledVector(perpVec, rA * 0.45);
  const termB1 = pB.clone().addScaledVector(sideVec, rB * 0.45).addScaledVector(perpVec, rB * 0.35);
  const mid1 = mainCurve.getPointAt(0.5).addScaledVector(sideVec, length * 0.045).addScaledVector(perpVec, length * 0.035);

  const curve1 = new THREE.CatmullRomCurve3([rootA1, mid1, termB1]);
  curves.push(curve1);
  const geom1 = new THREE.TubeGeometry(curve1, 40, mainRadius * 0.65, 6, false);
  filamentGeometries.push(geom1);
  const mesh1 = new THREE.Mesh(geom1, filamentMaterial);
  group.add(mesh1);
  filamentMeshes.push(mesh1);

  // 3. Dendritic Root Web 2: Lower Root fanning across Source Membrane -> twisting to Target
  const rootA2 = pA.clone().addScaledVector(sideVec, -rA * 0.6).addScaledVector(perpVec, -rA * 0.45);
  const termB2 = pB.clone().addScaledVector(sideVec, -rB * 0.4).addScaledVector(perpVec, -rB * 0.3);
  const mid2 = mainCurve.getPointAt(0.5).addScaledVector(sideVec, -length * 0.04).addScaledVector(perpVec, -length * 0.035);

  const curve2 = new THREE.CatmullRomCurve3([rootA2, mid2, termB2]);
  curves.push(curve2);
  const geom2 = new THREE.TubeGeometry(curve2, 40, mainRadius * 0.60, 6, false);
  filamentGeometries.push(geom2);
  const mesh2 = new THREE.Mesh(geom2, filamentMaterial);
  group.add(mesh2);
  filamentMeshes.push(mesh2);

  // 4. Helical Braiding Strand (Weaves gracefully around main spine)
  const rootA3 = pA.clone().addScaledVector(perpVec, rA * 0.7);
  const mid3A = mainCurve.getPointAt(0.32).addScaledVector(sideVec, -0.32).addScaledVector(perpVec, 0.25);
  const mid3B = mainCurve.getPointAt(0.68).addScaledVector(sideVec, 0.28).addScaledVector(perpVec, -0.22);
  const termB3 = pB.clone().addScaledVector(perpVec, -rB * 0.5);

  const curve3 = new THREE.CatmullRomCurve3([rootA3, mid3A, mid3B, termB3]);
  curves.push(curve3);
  const geom3 = new THREE.TubeGeometry(curve3, 44, mainRadius * 0.60, 6, false);
  filamentGeometries.push(geom3);
  const mesh3 = new THREE.Mesh(geom3, filamentMaterial);
  group.add(mesh3);
  filamentMeshes.push(mesh3);

  // 5. Additional Fanning Root Tendrils directly into source membrane (like dendritic roots in reference)
  const rootFanA = pA.clone().addScaledVector(sideVec, rA * 0.8).addScaledVector(dir, rA * 0.2);
  const rootFanJoin = mainCurve.getPointAt(0.2);
  const rootFanCurve = new THREE.QuadraticBezierCurve3(rootFanA, rootFanA.clone().addScaledVector(dir, length * 0.08), rootFanJoin);
  const rootFanGeom = new THREE.TubeGeometry(rootFanCurve, 18, mainRadius * 0.52, 5, false);
  filamentGeometries.push(rootFanGeom);
  const rootFanMesh = new THREE.Mesh(rootFanGeom, filamentMaterial);
  group.add(rootFanMesh);
  filamentMeshes.push(rootFanMesh);

  // 6. Delicate Branching Tendril peeling off into dark space
  const branchStart = mainCurve.getPointAt(0.44);
  const branchTip = branchStart.clone()
    .addScaledVector(sideVec, 0.95)
    .addScaledVector(perpVec, 0.7)
    .addScaledVector(dir, length * 0.14);
  const branchCurve = new THREE.QuadraticBezierCurve3(
    branchStart,
    branchStart.clone().addScaledVector(sideVec, 0.5).addScaledVector(perpVec, 0.35),
    branchTip
  );
  const branchGeom = new THREE.TubeGeometry(branchCurve, 20, mainRadius * 0.45, 5, false);
  filamentGeometries.push(branchGeom);
  const branchMesh = new THREE.Mesh(branchGeom, filamentMaterial);
  group.add(branchMesh);
  filamentMeshes.push(branchMesh);

  // 7. Radiant Moving Sparks System (Incandescent tiny action potentials)
  const sparkCount = conn.strength > 0.6 ? 3 : 2;
  const sparks: SparkState[] = [];
  const sparkCoreGeom = new THREE.SphereGeometry(0.065, 12, 10);
  const sparkHaloGeom = new THREE.SphereGeometry(0.16, 12, 10);
  const sparkTrailGeom = new THREE.SphereGeometry(0.045, 10, 8);

  for (let s = 0; s < sparkCount; s++) {
    const targetCurve = curves[s % curves.length];
    const speed = 0.035 + s * 0.015 + Math.sin(s * 2.5 + length) * 0.008;
    const phase = s / sparkCount + Math.sin(s * 3.4) * 0.12;
    const direction = (s % 2 === 0 ? 1 : -1) as 1 | -1;

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(sparkColorHex),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const trail1Mat = new THREE.MeshBasicMaterial({
      color: strandColor,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const trail2Mat = new THREE.MeshBasicMaterial({
      color: strandColor,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const leadMesh = new THREE.Mesh(sparkCoreGeom, coreMat);
    const haloMesh = new THREE.Mesh(sparkHaloGeom, haloMat);
    const trail1Mesh = new THREE.Mesh(sparkTrailGeom, trail1Mat);
    const trail2Mesh = new THREE.Mesh(sparkTrailGeom, trail2Mat);

    group.add(haloMesh);
    group.add(leadMesh);
    group.add(trail1Mesh);
    group.add(trail2Mesh);

    sparks.push({
      curve: targetCurve,
      speed,
      phase,
      direction,
      leadMesh,
      haloMesh,
      trail1Mesh,
      trail2Mesh,
      coreMat,
      haloMat,
      trail1Mat,
      trail2Mat,
    });
  }

  // Smooth animation loop
  const updateAnimation = (time: number, isReducedMotion: boolean, isConnectedToSelected: boolean) => {
    const t = time;

    // Respiration of filament glow - calm, subtle and non-intrusive
    if (isConnectedToSelected) {
      filamentMaterial.emissiveIntensity = 0.65 + Math.sin(t * 1.5) * 0.15;
      filamentMaterial.opacity = 0.75;
    } else {
      filamentMaterial.emissiveIntensity = 0.22 + Math.sin(t * 0.8 + length) * 0.06;
      filamentMaterial.opacity = baseFilamentOpacity;
    }

    if (isReducedMotion) return;

    // Update moving sparks along curved spline trajectories
    sparks.forEach((spark) => {
      let progress = ((t * spark.speed + spark.phase) % 1.0);
      if (spark.direction === -1) {
        progress = 1.0 - progress;
      }

      const pointLead = spark.curve.getPointAt(progress);
      spark.leadMesh.position.copy(pointLead);
      spark.haloMesh.position.copy(pointLead);

      // Trailing beads with slight delta offset
      const trailOffset1 = spark.direction === 1 ? -0.025 : 0.025;
      const trailOffset2 = spark.direction === 1 ? -0.05 : 0.05;

      const pTrail1 = Math.max(0, Math.min(1, progress + trailOffset1));
      const pTrail2 = Math.max(0, Math.min(1, progress + trailOffset2));

      spark.trail1Mesh.position.copy(spark.curve.getPointAt(pTrail1));
      spark.trail2Mesh.position.copy(spark.curve.getPointAt(pTrail2));

      // Sine fade envelope: Smoothly emerges from source node and dissolves gracefully into target
      const fadeEnvelope = Math.sin(progress * Math.PI);
      const intensity = Math.pow(fadeEnvelope, 0.85);

      spark.coreMat.opacity = intensity;
      spark.haloMat.opacity = intensity * 0.8;
      spark.trail1Mat.opacity = intensity * 0.55;
      spark.trail2Mat.opacity = intensity * 0.28;
    });
  };

  const dispose = () => {
    filamentGeometries.forEach((g) => g.dispose());
    filamentMaterial.dispose();
    sparkCoreGeom.dispose();
    sparkHaloGeom.dispose();
    sparkTrailGeom.dispose();
    sparks.forEach((s) => {
      s.coreMat.dispose();
      s.haloMat.dispose();
      s.trail1Mat.dispose();
      s.trail2Mat.dispose();
    });
    group.clear();
  };

  return {
    group,
    connectionData: conn,
    updateAnimation,
    dispose,
  };
}
