import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EmotionalLandscapeData, LandscapeNode } from '../../types/landscape';
import { NodeMeshBundle, createOrganicNodeMesh } from './OrganicNodeMesh';
import { NeuronMeshBundle, createNeuronConnectionMesh } from './NeuronConnectionMesh';

export interface EmotionalLandscapeCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  resetCamera: () => void;
}

export interface EmotionalLandscapeCanvasProps {
  landscapeData: EmotionalLandscapeData;
  selectedNodeId: string | null;
  onSelectNode: (node: LandscapeNode | null) => void;
  zoomLevel: 'overview' | 'medium' | 'close';
  isReducedMotion: boolean;
  onHoverNode?: (node: LandscapeNode | null) => void;
}

/**
 * Creates a procedural studio lighting environment map using PMREMGenerator.
 * Equips MeshPhysicalMaterial with rich clearcoat reflections, subtle Fresnel rim highlights,
 * and realistic internal fluid refraction.
 */
function createStudioEnvironmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep dark atmospheric gradient base
    const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
    baseGrad.addColorStop(0, '#0c101d');
    baseGrad.addColorStop(0.5, '#070912');
    baseGrad.addColorStop(1, '#05060a');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm Studio Key Light (Top-Right quadrant)
    const warmGrad = ctx.createRadialGradient(width * 0.72, height * 0.28, 0, width * 0.72, height * 0.28, width * 0.42);
    warmGrad.addColorStop(0, 'rgba(255, 240, 210, 0.95)');
    warmGrad.addColorStop(0.4, 'rgba(235, 185, 120, 0.45)');
    warmGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = warmGrad;
    ctx.fillRect(0, 0, width, height);

    // Cool Studio Fill Light (Left hemisphere)
    const coolGrad = ctx.createRadialGradient(width * 0.22, height * 0.38, 0, width * 0.22, height * 0.38, width * 0.38);
    coolGrad.addColorStop(0, 'rgba(160, 200, 240, 0.75)');
    coolGrad.addColorStop(0.5, 'rgba(90, 130, 180, 0.25)');
    coolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coolGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Horizon Ember Haze
    const emberGrad = ctx.createRadialGradient(width * 0.5, height * 0.65, 0, width * 0.5, height * 0.65, width * 0.35);
    emberGrad.addColorStop(0, 'rgba(180, 120, 70, 0.35)');
    emberGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = emberGrad;
    ctx.fillRect(0, 0, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader();
  const envMap = pmremGen.fromEquirectangular(texture).texture;
  pmremGen.dispose();
  texture.dispose();

  return envMap;
}

/**
 * Creates the cinematic dark space backdrop matching the reference image:
 * - Deep obsidian space base (#030407)
 * - Faint warm golden celestial nebula glow centered behind the Incident Horizon
 * - Cool slate/indigo cosmic dust clouds in upper quadrants
 * - Subtle silhouetted atmospheric mountain ridges along the bottom horizon
 * - Faint stardust speckles
 */
function createNebulaBackdrop(): THREE.Mesh {
  const width = 1280;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 1. Deep dark charcoal-black / midnight navy base
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle diagonal blue-black atmospheric gradient
    const atmGrad = ctx.createRadialGradient(
      width * 0.40,
      height * 0.40,
      20,
      width * 0.50,
      height * 0.50,
      width * 0.70
    );
    atmGrad.addColorStop(0, 'rgba(16, 25, 42, 0.22)');
    atmGrad.addColorStop(0.5, 'rgba(8, 14, 25, 0.10)');
    atmGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Very faint warm amber haze directly behind central emotional core
    const warmHaze = ctx.createRadialGradient(
      width * 0.50,
      height * 0.48,
      10,
      width * 0.50,
      height * 0.48,
      width * 0.36
    );
    warmHaze.addColorStop(0, 'rgba(65, 40, 16, 0.18)');
    warmHaze.addColorStop(0.4, 'rgba(38, 23, 10, 0.08)');
    warmHaze.addColorStop(0.8, 'rgba(14, 10, 12, 0.02)');
    warmHaze.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = warmHaze;
    ctx.fillRect(0, 0, width, height);

    // 4. Subtle, soft vignette darkening corners and edges
    const vignette = ctx.createRadialGradient(
      width * 0.50,
      height * 0.50,
      width * 0.28,
      width * 0.50,
      height * 0.50,
      width * 0.72
    );
    vignette.addColorStop(0, 'rgba(4, 6, 10, 0)');
    vignette.addColorStop(0.65, 'rgba(3, 4, 8, 0.60)');
    vignette.addColorStop(1, 'rgba(2, 3, 6, 0.95)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const geom = new THREE.PlaneGeometry(800, 500);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, 0, -220);
  return mesh;
}

/**
 * Computes optimal camera distance framing the entire emotional solar system:
 * - Calculates effective bounding envelope based on 3D spread and node base radii
 * - Adapts to viewport aspect ratio (portrait mobile vs ultrawide desktop)
 * - Adds generous margin to ensure outer orbit planets and their labels are never clipped
 */
export function computeFramingRadius(nodes: LandscapeNode[], aspect: number): number {
  if (!nodes || nodes.length === 0) return 32;

  let maxExtentX = 0;
  let maxExtentY = 0;
  let maxExtent3D = 0;

  for (const n of nodes) {
    const [x, y, z] = n.position;
    const absX = Math.abs(x) + n.baseRadius;
    const absY = Math.abs(y) + n.baseRadius;
    const r3D = Math.sqrt(x * x + y * y + z * z) + n.baseRadius;

    if (absX > maxExtentX) maxExtentX = absX;
    if (absY > maxExtentY) maxExtentY = absY;
    if (r3D > maxExtent3D) maxExtent3D = r3D;
  }

  // Camera vertical FOV is 40 deg. tan(20 deg) = 0.36397
  const tanHalfFov = Math.tan((20 * Math.PI) / 180);
  const safeAspect = Math.max(0.55, aspect || 1.6);

  // Label margin allowance in world units
  const marginY = 3.2;
  const marginX = 4.2;

  const distVertical = (maxExtentY + marginY) / tanHalfFov;
  const distHorizontal = (maxExtentX + marginX) / (tanHalfFov * safeAspect);

  const baseDistance = Math.max(distVertical, distHorizontal, maxExtent3D * 1.35) * 1.14;

  // Clamped to sensible cinematic range: minimum 26, maximum 48
  return Math.max(26, Math.min(48, baseDistance));
}

export const EmotionalLandscapeCanvas = forwardRef<
  EmotionalLandscapeCanvasHandle,
  EmotionalLandscapeCanvasProps
>(({
  landscapeData,
  selectedNodeId,
  onSelectNode,
  zoomLevel,
  isReducedMotion,
  onHoverNode,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsOverlayRef = useRef<HTMLDivElement>(null);
  const labelDomsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Mesh bundles
  const nodeBundlesRef = useRef<NodeMeshBundle[]>([]);
  const connBundlesRef = useRef<NeuronMeshBundle[]>([]);

  // Camera Orbit & Interpolation State (Tuned for ~34 units spacious solar system)
  const cameraTargetPos = useRef(new THREE.Vector3(0, 1.0, 34.0));
  const cameraLookAtPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentLookAtPos = useRef(new THREE.Vector3(0, 0, 0));

  const sphericalCoords = useRef({
    radius: 34.0,
    theta: Math.PI / 2, // Frontal perspective
    phi: 1.51,         // Slight elevation
  });

  // Keep responsive props in mutable refs to avoid resetting animation loops
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  const isReducedMotionRef = useRef(isReducedMotion);
  isReducedMotionRef.current = isReducedMotion;

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  // Interaction tracking
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartRadius = useRef<number>(34.0);

  // Raycasting
  const raycaster = useRef(new THREE.Raycaster());
  const mousePos = useRef(new THREE.Vector2(-999, -999));
  const hoveredNodeRef = useRef<LandscapeNode | null>(null);

  const updateCameraTargetFromSpherical = () => {
    const selectedNode = landscapeData.nodes.find((n) => n.id === selectedNodeIdRef.current);
    if (selectedNode) {
      const [nx, ny, nz] = selectedNode.position;
      const immerseDist = selectedNode.baseRadius * 3.0 + 6.5;
      cameraLookAtPos.current.set(nx, ny, nz);
      cameraTargetPos.current.set(
        nx + immerseDist * Math.sin(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi),
        ny + immerseDist * Math.cos(sphericalCoords.current.phi) + 0.35,
        nz + immerseDist * Math.cos(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi)
      );
    } else {
      const rad = sphericalCoords.current.radius;
      cameraLookAtPos.current.set(0, 0, 0);
      cameraTargetPos.current.set(
        rad * Math.sin(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi),
        rad * Math.cos(sphericalCoords.current.phi) + 0.8,
        rad * Math.cos(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi)
      );
    }
  };

  // Zoom Toolbar Handlers
  const handleZoomIn = () => {
    sphericalCoords.current.radius = Math.max(10.0, sphericalCoords.current.radius * 0.82);
    updateCameraTargetFromSpherical();
  };

  const handleZoomOut = () => {
    sphericalCoords.current.radius = Math.min(44.0, sphericalCoords.current.radius * 1.20);
    updateCameraTargetFromSpherical();
  };

  const handleFitView = () => {
    onSelectNode(null);
    const container = containerRef.current;
    const aspect = container ? container.clientWidth / (container.clientHeight || 1) : 1.6;
    const baseFraming = computeFramingRadius(landscapeData.nodes, aspect);
    sphericalCoords.current.radius = baseFraming;
    sphericalCoords.current.theta = Math.PI / 2;
    sphericalCoords.current.phi = 1.51;
    cameraLookAtPos.current.set(0, 0, 0);
    updateCameraTargetFromSpherical();
  };

  const handleResetCamera = () => {
    onSelectNode(null);
    const container = containerRef.current;
    const aspect = container ? container.clientWidth / (container.clientHeight || 1) : 1.6;
    const baseFraming = computeFramingRadius(landscapeData.nodes, aspect);
    sphericalCoords.current.radius = baseFraming;
    sphericalCoords.current.theta = Math.PI / 2;
    sphericalCoords.current.phi = 1.51;
    cameraLookAtPos.current.set(0, 0, 0);
    updateCameraTargetFromSpherical();
  };

  useImperativeHandle(ref, () => ({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    fitView: handleFitView,
    resetCamera: handleResetCamera,
  }));

  // Camera Framing & Transition (Automatically frames entire system with generous margins)
  useEffect(() => {
    const selectedNode = landscapeData.nodes.find((n) => n.id === selectedNodeId);

    if (selectedNode) {
      // Immersion Mode: Smoothly glide toward the selected emotional node
      const [nx, ny, nz] = selectedNode.position;
      cameraLookAtPos.current.set(nx, ny, nz);

      const immerseDist = selectedNode.baseRadius * 3.2 + 7.5;
      cameraTargetPos.current.set(
        nx + immerseDist * Math.sin(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi),
        ny + immerseDist * Math.cos(sphericalCoords.current.phi) + 0.4,
        nz + immerseDist * Math.cos(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi)
      );
    } else {
      // Overview / Exploration Mode: Generous frontal framing of entire constellation
      cameraLookAtPos.current.set(0, 0, 0);

      const container = containerRef.current;
      const aspect = container ? (container.clientWidth / (container.clientHeight || 1)) : 1.6;
      const baseFraming = computeFramingRadius(landscapeData.nodes, aspect);

      const zoomMultiplier = zoomLevel === 'close' ? 0.72 : zoomLevel === 'medium' ? 0.86 : 1.0;
      const rad = baseFraming * zoomMultiplier;
      sphericalCoords.current.radius = rad;

      cameraTargetPos.current.set(
        rad * Math.sin(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi),
        rad * Math.cos(sphericalCoords.current.phi) + 0.8,
        rad * Math.cos(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi)
      );
    }
  }, [selectedNodeId, zoomLevel, landscapeData.nodes]);

  // Main Three.js Scene Setup (Only executes when the active entry ID changes)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const width = container.clientWidth || window.innerWidth || 800;
      const height = container.clientHeight || window.innerHeight - 60 || 600;

      // 1. Scene & Atmosphere
      const scene = new THREE.Scene();
      const fogHex = '#04060a';
      scene.background = new THREE.Color(fogHex);
      sceneRef.current = scene;

      // Exponential fog preserving vivid clarity for midground nodes across expansive universe
      scene.fog = new THREE.FogExp2(new THREE.Color(fogHex), 0.0016);

      // 2. Camera Setup (Frontal perspective matching reference composition)
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1200);
      camera.position.set(0, 1.0, 34.0);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // 3. High-Precision WebGL Renderer & Cinematic Postprocessing
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.85;
      rendererRef.current = renderer;

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // Realistic Cinematic Bloom Pipeline (Subtle bloom for incandescent star core and tiny sparks only)
      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.22, // Controlled subtle Bloom strength
        0.28, // Bloom radius
        0.85  // High Bloom threshold so only incandescent sparks and star core emit bloom
      );
      composer.addPass(bloomPass);
      composerRef.current = composer;

      // 4. Studio Environment Lighting Map for Realistic Glass Reflections & Refractions
      const studioEnv = createStudioEnvironmentMap(renderer);
      scene.environment = studioEnv;

      // 5. Cinematic Art-Directed Dark Studio Lighting Rig
      const ambientLight = new THREE.AmbientLight(0x0a101a, 0.35);
      scene.add(ambientLight);

      const hemiLight = new THREE.HemisphereLight(0x32465e, 0x05070a, 0.35);
      scene.add(hemiLight);

      // Warm key light
      const keyLight = new THREE.DirectionalLight(0xfff5ea, 0.95);
      keyLight.position.set(16, 18, 18);
      scene.add(keyLight);

      // Cool fill light
      const fillLight = new THREE.DirectionalLight(0x526b86, 0.45);
      fillLight.position.set(-18, 10, -12);
      scene.add(fillLight);

      // Soft rim light
      const rimLight = new THREE.DirectionalLight(0x7c98b2, 0.55);
      rimLight.position.set(0, -14, -16);
      scene.add(rimLight);

      // Central node warm radiant spill light (behaving like an incandescent central star)
      const centerSpillLight = new THREE.PointLight(0xd97706, 0.85, 90, 1.4);
      centerSpillLight.position.set(0, 0, 0);
      scene.add(centerSpillLight);

      // 6. Atmospheric Nebula Backdrop Plane
      const backdrop = createNebulaBackdrop();
      scene.add(backdrop);

      // 7. Build 3D Sculpted Organic Nodes
      const nodeBundles: NodeMeshBundle[] = [];
      const nodeMap = new Map<string, LandscapeNode>();

      landscapeData.nodes.forEach((node) => {
        nodeMap.set(node.id, node);
        const bundle = createOrganicNodeMesh(node);
        scene.add(bundle.group);
        nodeBundles.push(bundle);
      });
      nodeBundlesRef.current = nodeBundles;

      // 8. Build Radiant Branching Neural Connections & Sparks
      const connBundles: NeuronMeshBundle[] = [];
      landscapeData.connections.forEach((conn) => {
        const srcNode = nodeMap.get(conn.sourceId);
        const tgtNode = nodeMap.get(conn.targetId);
        if (srcNode && tgtNode) {
          const bundle = createNeuronConnectionMesh(conn, srcNode, tgtNode);
          scene.add(bundle.group);
          connBundles.push(bundle);
        }
      });
      connBundlesRef.current = connBundles;

      // 9. Distant Stardust & Micro-Particles (Ambient celestial depth)
      const dustCount = 55;
      const dustGeom = new THREE.BufferGeometry();
      const dustPositions = new Float32Array(dustCount * 3);

      for (let i = 0; i < dustCount; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 52;
        dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 34;
        dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 44 - 4;
      }
      dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

      const dustMat = new THREE.PointsMaterial({
        color: 0x8a9eb8,
        size: 0.08,
        transparent: true,
        opacity: 0.16,
      });
      const dustPoints = new THREE.Points(dustGeom, dustMat);
      scene.add(dustPoints);

      // 10. Animation & In-Scene Label Projection Loop
      const clock = new THREE.Clock();
      const tempVec = new THREE.Vector3();

      const animate = () => {
        animationFrameIdRef.current = requestAnimationFrame(animate);

        try {
          const elapsedTime = clock.getElapsedTime();

          // Camera smooth damping
          const lerpSpeed = isReducedMotionRef.current ? 0.08 : 0.045;
          camera.position.lerp(cameraTargetPos.current, lerpSpeed);
          currentLookAtPos.current.lerp(cameraLookAtPos.current, lerpSpeed);
          camera.lookAt(currentLookAtPos.current);

          const currentSelected = selectedNodeIdRef.current;

          // Update nodes respiration and inner filaments
          nodeBundlesRef.current.forEach((bundle) => {
            const isSelected = bundle.nodeData.id === currentSelected;
            bundle.updateAnimation(elapsedTime, isReducedMotionRef.current, isSelected);
          });

          // Update connections dynamic atmospheric pulse and moving sparks
          connBundlesRef.current.forEach((bundle) => {
            const isConnectedToSelected = Boolean(
              currentSelected &&
                (bundle.connectionData.sourceId === currentSelected ||
                  bundle.connectionData.targetId === currentSelected)
            );
            bundle.updateAnimation(elapsedTime, isReducedMotionRef.current, isConnectedToSelected);
          });

          // Stardust gentle drift
          if (!isReducedMotionRef.current) {
            dustPoints.rotation.y = elapsedTime * 0.0035;
          }

          // Project In-Scene 3D Floating Node Labels directly into screen-space
          const containerW = container.clientWidth || width;
          const containerH = container.clientHeight || height;
          const tanHalfFov = Math.tan(((camera.fov || 40) * Math.PI) / 360);

          type ProjectedLabel = {
            node: LandscapeNode;
            el: HTMLDivElement;
            cx: number;
            cy: number;
            targetX: number;
            targetY: number;
            scale: number;
            distToCamera: number;
            isCentral: boolean;
          };

          const projectedList: ProjectedLabel[] = [];

          landscapeData.nodes.forEach((node) => {
            const labelEl = labelDomsRef.current.get(node.id);
            if (!labelEl) return;

            tempVec.set(node.position[0], node.position[1], node.position[2]);
            const distToCamera = camera.position.distanceTo(tempVec);

            tempVec.project(camera);

            // Behind-camera clip check
            if (tempVec.z < 1.0) {
              const cx = (tempVec.x * 0.5 + 0.5) * containerW;
              const cy = (-tempVec.y * 0.5 + 0.5) * containerH;

              // Projected on-screen radius of the 3D node sphere in pixels
              const nodeRadiusPx = Math.max(
                14,
                (node.baseRadius / (distToCamera * tanHalfFov)) * (containerH / 2)
              );

              // Depth scaling: smooth, clamp-bounded scale factor
              const depthScale = Math.min(1.15, Math.max(0.72, 32.0 / distToCamera));
              const viewportScale = containerW < 640 ? 0.82 : containerW < 1024 ? 0.90 : 1.0;
              const isSelected = node.id === currentSelected;
              const scale = depthScale * viewportScale * (isSelected ? 1.08 : 1.0);

              const isCentral = node.category === 'central_incident';
              let targetX = cx;
              let targetY = cy;

              if (isCentral) {
                // Central incident sits right over/centered on the central star
                targetX = cx;
                targetY = cy;
              } else {
                // Radially outward relative to screen center
                const dirX = cx - containerW * 0.5;
                const dirY = cy - containerH * 0.5;
                const len = Math.hypot(dirX, dirY) || 1;
                const ndx = dirX / len;
                const ndy = dirY / len;
                const offsetDist = nodeRadiusPx + 11 * scale;

                targetX = cx + ndx * offsetDist;
                targetY = cy + ndy * offsetDist;
              }

              // Dynamic quote visibility based on distance and node importance
              const quoteEl = labelEl.querySelector<HTMLDivElement>('.label-quote');
              if (quoteEl) {
                const showQuote =
                  isSelected ||
                  isCentral ||
                  (distToCamera <= 35.0 && (node.narrativeImportance >= 0.52 || node.baseRadius >= 1.8));
                quoteEl.style.display = showQuote ? 'block' : 'none';
              }

              projectedList.push({
                node,
                el: labelEl,
                cx,
                cy,
                targetX,
                targetY,
                scale,
                distToCamera,
                isCentral,
              });
            } else {
              labelEl.style.display = 'none';
            }
          });

          // Screen-space 2D relaxation pass (4 iterations to prevent overlapping labels)
          for (let pass = 0; pass < 4; pass++) {
            for (let i = 0; i < projectedList.length; i++) {
              for (let j = i + 1; j < projectedList.length; j++) {
                const itemA = projectedList[i];
                const itemB = projectedList[j];

                // Central node remains securely anchored in center
                if (itemA.isCentral && itemB.isCentral) continue;

                const avgScale = (itemA.scale + itemB.scale) * 0.5;
                const minSeparationX = 138 * avgScale;
                const minSeparationY = 38 * avgScale;

                const dx = itemB.targetX - itemA.targetX;
                const dy = itemB.targetY - itemA.targetY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (absDx < minSeparationX && absDy < minSeparationY) {
                  const overlapX = minSeparationX - absDx;
                  const overlapY = minSeparationY - absDy;

                  if (itemA.isCentral) {
                    const pushX = overlapX * (dx >= 0 ? 1 : -1);
                    const pushY = overlapY * (dy >= 0 ? 1 : -1);
                    if (overlapY < overlapX * 0.4) {
                      itemB.targetY += pushY;
                    } else {
                      itemB.targetX += pushX;
                    }
                  } else if (itemB.isCentral) {
                    const pushX = overlapX * (dx >= 0 ? -1 : 1);
                    const pushY = overlapY * (dy >= 0 ? -1 : 1);
                    if (overlapY < overlapX * 0.4) {
                      itemA.targetY += pushY;
                    } else {
                      itemA.targetX += pushX;
                    }
                  } else {
                    if (overlapY < overlapX * 0.4) {
                      const pushY = overlapY * 0.5;
                      const signY = dy >= 0 ? 1 : -1;
                      itemA.targetY -= pushY * signY;
                      itemB.targetY += pushY * signY;
                    } else {
                      const pushX = overlapX * 0.5;
                      const signX = dx >= 0 ? 1 : -1;
                      itemA.targetX -= pushX * signX;
                      itemB.targetX += pushX * signX;
                    }
                  }
                }
              }
            }
          }

          // Apply transform, scale, clamping, and z-index to all labels
          projectedList.forEach(({ node, el, targetX, targetY, scale, distToCamera, isCentral }) => {
            const marginX = Math.round(80 * scale);
            const marginY = Math.round(26 * scale);
            const clampedX = Math.max(marginX, Math.min(containerW - marginX, targetX));
            const clampedY = Math.max(marginY, Math.min(containerH - marginY, targetY));

            el.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
            el.style.transformOrigin = 'center center';
            el.style.display = 'block';

            // Z-index hierarchy: selected highest (50), central second (40), then depth-based
            if (node.id === currentSelected) {
              el.style.zIndex = '50';
              el.style.opacity = '1';
            } else if (currentSelected) {
              el.style.zIndex = '10';
              el.style.opacity = '0.22';
            } else if (isCentral) {
              el.style.zIndex = '40';
              el.style.opacity = '1';
            } else {
              el.style.zIndex = String(Math.max(1, Math.round(100 - distToCamera)));
              el.style.opacity = '1';
            }
          });

          composer.render();
        } catch (frameError) {
          console.error('[EmotionalLandscapeCanvas Render Error]:', frameError);
        }
      };

      animationFrameIdRef.current = requestAnimationFrame(animate);

      // Resize observer with automatic re-framing
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
            const aspect = w / h;
            cameraRef.current.aspect = aspect;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(w, h);
            composerRef.current?.setSize(w, h);

            if (!selectedNodeIdRef.current) {
              const baseFraming = computeFramingRadius(landscapeData.nodes, aspect);
              const zoomMultiplier =
                zoomLevelRef.current === 'close' ? 0.72 : zoomLevelRef.current === 'medium' ? 0.86 : 1.0;
              const rad = baseFraming * zoomMultiplier;
              sphericalCoords.current.radius = rad;

              cameraTargetPos.current.set(
                rad * Math.sin(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi),
                rad * Math.cos(sphericalCoords.current.phi) + 0.8,
                rad * Math.cos(sphericalCoords.current.theta) * Math.sin(sphericalCoords.current.phi)
              );
            }
          }
        }
      });
      resizeObserver.observe(container);

      // Cleanup
      return () => {
        resizeObserver.disconnect();

        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }

        nodeBundlesRef.current.forEach((b) => b.dispose());
        connBundlesRef.current.forEach((b) => b.dispose());
        nodeBundlesRef.current = [];
        connBundlesRef.current = [];

        studioEnv.dispose();
        dustGeom.dispose();
        dustMat.dispose();
        backdrop.geometry.dispose();
        (backdrop.material as THREE.Material).dispose();

        composerRef.current?.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    } catch (setupError) {
      console.error('[EmotionalLandscapeCanvas Setup Error]:', setupError);
    }
  }, [landscapeData.entryId]);

  // Pointer Interaction Handlers (with multi-touch pinch-to-zoom)
  const handlePointerDown = (e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      isDraggingRef.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    } else if (activePointers.current.size === 2) {
      // Pinch to zoom started
      isDraggingRef.current = false;
      const pts = Array.from(activePointers.current.values());
      pinchStartDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartRadius.current = sphericalCoords.current.radius;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch-to-zoom handling for trackpads / touch devices
    if (activePointers.current.size === 2 && pinchStartDist.current) {
      const pts = Array.from(activePointers.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (currentDist > 0) {
        const factor = pinchStartDist.current / currentDist;
        sphericalCoords.current.radius = Math.max(
          13.0,
          Math.min(50.0, pinchStartRadius.current * factor)
        );
        updateCameraTargetFromSpherical();
      }
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mousePos.current.set(x, y);

    // Orbit controls when dragging
    if (isDraggingRef.current) {
      const deltaX = e.clientX - previousMousePosition.current.x;
      const deltaY = e.clientY - previousMousePosition.current.y;

      const rotateSpeed = 0.0055;
      sphericalCoords.current.theta -= deltaX * rotateSpeed;
      sphericalCoords.current.phi = Math.max(
        0.25,
        Math.min(Math.PI - 0.25, sphericalCoords.current.phi - deltaY * rotateSpeed)
      );

      updateCameraTargetFromSpherical();
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Node hover detection via raycasting
    if (cameraRef.current && nodeBundlesRef.current.length > 0) {
      raycaster.current.setFromCamera(mousePos.current, cameraRef.current);
      const meshes = nodeBundlesRef.current.map((b) => b.outerMesh);
      const intersects = raycaster.current.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const node = (hitMesh as any).nodeData as LandscapeNode;
        if (node && hoveredNodeRef.current?.id !== node.id) {
          hoveredNodeRef.current = node;
          if (onHoverNode) onHoverNode(node);
        }
      } else if (hoveredNodeRef.current !== null) {
        hoveredNodeRef.current = null;
        if (onHoverNode) onHoverNode(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) {
      pinchStartDist.current = null;
    }

    const wasDragging =
      Math.abs(e.clientX - previousMousePosition.current.x) > 3 ||
      Math.abs(e.clientY - previousMousePosition.current.y) > 3;

    isDraggingRef.current = false;

    // Direct click selection check if not dragging
    if (!wasDragging && cameraRef.current) {
      raycaster.current.setFromCamera(mousePos.current, cameraRef.current);
      const meshes = nodeBundlesRef.current.map((b) => b.outerMesh);
      const intersects = raycaster.current.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const node = (hitMesh as any).nodeData as LandscapeNode;
        if (node) {
          onSelectNode(node);
        }
      } else {
        // Clicking empty space returns gracefully to Overview
        onSelectNode(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.016;
    sphericalCoords.current.radius = Math.max(
      13.0,
      Math.min(50.0, sphericalCoords.current.radius + zoomDelta)
    );
    updateCameraTargetFromSpherical();
  };

  return (
    <div
      className="w-full h-full relative select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
    >
      {/* 3D WebGL Canvas Container */}
      <div
        ref={containerRef}
        id="emotional-landscape-canvas-container"
        className="w-full h-full"
      />

      {/* In-Scene Floating 3D Node Labels (Spacious, Dynamic Depth Scaled, Non-Overlapping) */}
      <div
        ref={labelsOverlayRef}
        id="emotional-landscape-3d-labels-overlay"
        className="absolute inset-0 pointer-events-none overflow-hidden select-none"
      >
        {landscapeData.nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isCentral = node.category === 'central_incident';
          const hasQuote = Boolean(node.groundedQuote && node.groundedQuote.trim().length > 0);

          return (
            <div
              key={node.id}
              ref={(el) => {
                if (el) {
                  labelDomsRef.current.set(node.id, el);
                } else {
                  labelDomsRef.current.delete(node.id);
                }
              }}
              id={`3d-label-${node.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node);
              }}
              className={`absolute top-0 left-0 pointer-events-auto cursor-pointer text-center group transition-[border,box-shadow,background-color] duration-200 select-none ${
                isCentral
                  ? 'py-2 px-4 rounded-2xl bg-[#080b12]/90 backdrop-blur-xl border border-amber-400/50 shadow-[0_8px_32px_rgba(217,119,6,0.25)] hover:border-amber-400/80'
                  : 'py-1 px-3 rounded-xl bg-[#06080e]/85 backdrop-blur-xl border border-white/[0.10] shadow-[0_6px_24px_rgba(0,0,0,0.7)] hover:border-white/30 hover:bg-[#0c1220]/90'
              } ${isSelected ? 'ring-2 ring-amber-400/90 shadow-[0_0_28px_rgba(245,158,11,0.45)]' : ''}`}
              style={{
                display: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                willChange: 'transform, opacity',
              }}
              title={`Explore ${node.shortLabel}`}
            >
              {/* Node Title */}
              <div
                className={`font-semibold tracking-tight transition-colors drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] whitespace-nowrap ${
                  isCentral
                    ? 'text-[14px] sm:text-[15px] text-[#fff8ee] group-hover:text-white'
                    : 'text-[11.5px] sm:text-[12.5px] text-white/95 group-hover:text-white'
                }`}
              >
                {node.shortLabel}
              </div>

              {/* Verbatim Grounded Reflection Quote */}
              {hasQuote && (
                <div
                  className={`label-quote font-serif italic max-w-[170px] mx-auto mt-0.5 leading-tight line-clamp-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] transition-colors ${
                    isCentral
                      ? 'text-[11px] text-[#fed7aa]/95 group-hover:text-white'
                      : 'text-[9.5px] text-[#cbd5e1]/80 group-hover:text-white'
                  }`}
                >
                  &ldquo;{node.groundedQuote.length > 40 ? `${node.groundedQuote.slice(0, 40)}…` : node.groundedQuote}&rdquo;
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

EmotionalLandscapeCanvas.displayName = 'EmotionalLandscapeCanvas';
