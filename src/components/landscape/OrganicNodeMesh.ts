import * as THREE from 'three';
import { LandscapeNode } from '../../types/landscape';

export interface NodeMeshBundle {
  group: THREE.Group;
  outerMesh: THREE.Mesh;
  pointLight: THREE.PointLight;
  nodeData: LandscapeNode;
  updateAnimation: (time: number, isReducedMotion: boolean, isSelected: boolean) => void;
  dispose: () => void;
}

/**
 * Creates a procedural incandescent star flare texture for the central luminous core.
 */
function createStarFlareTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;

  // Multi-layered incandescent warm amber-gold radial core glow
  // Soft, calm, and organic without harsh white cross beams
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.72);
  grad.addColorStop(0, 'rgba(255, 252, 240, 0.96)');
  grad.addColorStop(0.12, 'rgba(255, 235, 175, 0.82)');
  grad.addColorStop(0.28, 'rgba(245, 185, 95, 0.42)');
  grad.addColorStop(0.50, 'rgba(195, 125, 45, 0.14)');
  grad.addColorStop(0.75, 'rgba(120, 65, 20, 0.04)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle inner focal core
  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.22);
  innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  innerGrad.addColorStop(0.4, 'rgba(255, 245, 210, 0.65)');
  innerGrad.addColorStop(1.0, 'rgba(255, 230, 160, 0.0)');
  ctx.fillStyle = innerGrad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let sharedStarTexture: THREE.CanvasTexture | null = null;
function getStarTexture(): THREE.CanvasTexture {
  if (!sharedStarTexture) {
    sharedStarTexture = createStarFlareTexture();
  }
  return sharedStarTexture;
}

let sharedSatelliteKnotTexture: THREE.CanvasTexture | null = null;
function getSatelliteKnotTexture(): THREE.CanvasTexture {
  if (!sharedSatelliteKnotTexture) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cx = size / 2;
      const cy = size / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.5);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.18, 'rgba(255, 252, 240, 0.90)');
      grad.addColorStop(0.42, 'rgba(255, 230, 180, 0.40)');
      grad.addColorStop(0.70, 'rgba(220, 170, 110, 0.10)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    sharedSatelliteKnotTexture = new THREE.CanvasTexture(canvas);
    sharedSatelliteKnotTexture.needsUpdate = true;
  }
  return sharedSatelliteKnotTexture;
}

/**
 * Procedurally sculpts high-resolution sphere geometry into smooth Blender-style organic amoeba forms.
 * Uses continuous Gaussian bell curves, harmonic membrane folds, and biological root funnels
 * where neural filaments anchor to the membrane.
 */
function sculptOrganicFluidForm(
  geometry: THREE.BufferGeometry,
  nodeData: LandscapeNode,
  radius: number
) {
  const posAttr = geometry.attributes.position;
  const count = posAttr.count;
  const { category, outerForm, weight, openness, conflict, shortLabel } = nodeData;

  // Asymmetric global tensor based on emotional role
  let sx = 1.18;
  let sy = 1.02;
  let sz = 0.88;

  const isCentral = category === 'central_incident';

  if (isCentral) {
    // Grand, expansive, majestic fluid soma with radiant center
    sx = 1.28;
    sy = 1.08;
    sz = 0.92;
  } else if (shortLabel.includes('Inner Calm') || nodeData.category === 'comfort') {
    // Elegant tilted oblong fluid cell, relaxed fluid crest (top left in reference)
    sx = 1.28;
    sy = 1.06;
    sz = 0.84;
  } else if (shortLabel.includes('Lingering Pressure') || nodeData.category === 'pressure') {
    // Dense, gravitationally weighted downward with folded creases (bottom left)
    sx = 1.14;
    sy = 0.92;
    sz = 0.94;
  } else if (shortLabel.includes('Gratitude') || nodeData.label.toLowerCase().includes('grat')) {
    // Elongated pear/teardrop droplet: tapered upper neck, buoyant lower base (bottom center)
    sx = 0.96;
    sy = 1.30;
    sz = 0.86;
  } else if (shortLabel.includes('Focused Mind') || nodeData.category === 'thought') {
    // Horizontally streamlined sleek fluid form (top right)
    sx = 1.38;
    sy = 0.92;
    sz = 0.80;
  } else if (shortLabel.includes('Quiet Joy') || nodeData.category === 'emotion') {
    // Buoyant, rounded warm fluid cell (bottom right)
    sx = 1.18;
    sy = 1.12;
    sz = 0.90;
  }

  // 3 Organic Lobe vectors for natural biological asymmetry
  const isLeft = nodeData.position[0] < -1;
  const isTop = nodeData.position[1] > 1;

  const lobe1 = new THREE.Vector3(isLeft ? -0.74 : 0.74, isTop ? 0.60 : -0.36, 0.24).normalize();
  const lobe2 = new THREE.Vector3(isLeft ? 0.42 : -0.42, isTop ? -0.62 : 0.46, -0.36).normalize();
  const lobe3 = new THREE.Vector3(0.06, isTop ? 0.70 : -0.70, 0.54).normalize();

  // Connection anchor vectors: satellite pulls toward center, central node roots pull toward satellites
  const dirToCenter = new THREE.Vector3(-nodeData.position[0], -nodeData.position[1], -nodeData.position[2]).normalize();
  const roots: THREE.Vector3[] = [];
  if (nodeData.connectedDirections && nodeData.connectedDirections.length > 0) {
    nodeData.connectedDirections.forEach((d) => {
      roots.push(new THREE.Vector3(d[0], d[1], d[2]).normalize());
    });
  } else if (isCentral) {
    roots.push(
      new THREE.Vector3(-0.86, 0.48, 0).normalize(),   // Inner Calm
      new THREE.Vector3(0.88, 0.45, 0).normalize(),    // Focused Mind
      new THREE.Vector3(-0.88, -0.46, 0).normalize(),  // Lingering Pressure
      new THREE.Vector3(-0.20, -0.98, 0).normalize(),  // Gratitude
      new THREE.Vector3(0.88, -0.46, 0).normalize()    // Quiet Joy
    );
  }

  const isGratitude = shortLabel.includes('Gratitude') || nodeData.label.toLowerCase().includes('grat');
  const isPressure = shortLabel.includes('Lingering Pressure') || nodeData.category === 'pressure';

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    // 1. Organic Lobe Bulges using smooth C^infinity Gaussian bell-curves
    const d1 = nx * lobe1.x + ny * lobe1.y + nz * lobe1.z;
    const d2 = nx * lobe2.x + ny * lobe2.y + nz * lobe2.z;
    const d3 = nx * lobe3.x + ny * lobe3.y + nz * lobe3.z;

    const lobe1Weight = Math.exp(-2.0 * Math.max(0.0, 1.0 - d1));
    const lobe2Weight = Math.exp(-2.2 * Math.max(0.0, 1.0 - d2));
    const lobe3Weight = Math.exp(-2.4 * Math.max(0.0, 1.0 - d3));

    const lobeDisplacement = lobe1Weight * 0.32 + lobe2Weight * 0.24 + lobe3Weight * 0.18;

    // 2. Harmonic fluid folds and living membrane ripples
    const h1 = Math.sin(nx * 2.2 + ny * 1.8) * Math.cos(nz * 2.0 + nx * 1.2);
    const h2 = Math.cos(ny * 2.8 + nz * 1.6) * Math.sin(nx * 1.8 + ny * 1.3);
    const h3 = Math.sin(nz * 2.9 + nx * 1.5) * Math.cos(ny * 2.2);
    const microFolds = (h1 * 0.06 + h2 * 0.05 + h3 * 0.04);

    // 3. Smooth organic crease / waist where fluid folds naturally
    const waistIndent = -0.10 * Math.exp(-Math.pow(ny * 1.8, 2)) * (1.0 - Math.abs(nx) * 0.3);

    // 4. Emotional gravitational weight modulation
    const sag = (weight - 0.5) * 0.28 * (-ny + 0.22 * (nx * nx + nz * nz));
    const open = (openness - 0.5) * 0.18 * (1.0 - Math.abs(ny) * 0.3);

    // 5. Prominent Biological Trumpet Root Funnels pulling membrane toward neural connections
    let rootBulge = 0.0;
    if (roots.length > 0) {
      for (const root of roots) {
        const dotRoot = nx * root.x + ny * root.y + nz * root.z;
        if (dotRoot > 0.15) {
          // Broad trumpet base tapering toward the connection cord
          rootBulge += Math.pow(dotRoot, 2.4) * (isCentral ? 0.34 : 0.38);
        }
      }
    } else if (!isCentral) {
      const dotAnchor = nx * dirToCenter.x + ny * dirToCenter.y + nz * dirToCenter.z;
      if (dotAnchor > 0.15) {
        rootBulge = Math.pow(dotAnchor, 2.4) * 0.36;
      }
    }

    // 6. Teardrop tapering for Gratitude (narrow upper neck, wider buoyant lower base)
    let teardropMod = 0.0;
    if (isGratitude) {
      teardropMod = -ny * 0.26 + (ny < 0 ? 0.14 : -0.10);
    }

    // 7. Heavy lower folds for Lingering Pressure
    let pressureMod = 0.0;
    if (isPressure) {
      pressureMod = (ny < 0 ? 0.22 * Math.abs(ny) : -0.12 * ny) + h1 * 0.08;
    }

    let formMod = 1.0 + lobeDisplacement + microFolds + waistIndent + sag + open + rootBulge + teardropMod + pressureMod;

    switch (outerForm) {
      case 'compressed_dense':
        formMod += -0.16 * (ny * ny) + 0.08 * h1 + 0.08 * (conflict * h2);
        break;
      case 'folded_inward':
        formMod += 0.08 * h2 - 0.15 * Math.exp(-2.2 * Math.max(0.0, 1.0 - (nx * 0.7 - ny * 0.4)));
        break;
      case 'stretched_distant':
        formMod += 0.20 * (nx * nx) + 0.08 * h3;
        break;
      case 'swollen_unstable':
        formMod += 0.16 * h1 + 0.12 * h2 + (conflict * 0.14);
        break;
      case 'smooth_expansive':
        formMod += 0.12 * h1 + 0.08 * h2;
        break;
      case 'heavy_grounded':
        formMod += -0.30 * ny + 0.10 * (nx * nx + nz * nz);
        break;
      case 'rounded_open':
      default:
        formMod += 0.08 * h1 + 0.05 * h2;
        break;
    }

    if (isCentral) {
      formMod += 0.06 * h1 + 0.04 * h2;
    }

    const finalR = radius * Math.max(0.60, formMod);

    const fx = nx * finalR * sx;
    const fy = ny * finalR * sy;
    const fz = nz * finalR * sz;

    posAttr.setXYZ(i, fx, fy, fz);
  }

  geometry.computeVertexNormals();
}

/**
 * Creates the translucent fluid glass membrane shader material.
 * Features:
 * - Internal light knot radiance & subsurface forward-scattering
 * - Delicate bioluminescent fibrous veils & caustics (spun silk look from reference)
 * - Translucent smoked gemstone fluid body (deep shadow without becoming flat mud)
 * - Crisp, luminous gossamer Fresnel rim edge
 * - Liquid clearcoat specular highlights
 */
function createTranslucentMembraneMaterial(
  darkBaseHex: string,
  bodyColorHex: string,
  rimColorHex: string,
  glowColorHex: string,
  corePos: THREE.Vector3,
  isCentral: boolean
): THREE.ShaderMaterial {
  const darkBase = new THREE.Color(darkBaseHex);
  const bodyColor = new THREE.Color(bodyColorHex);
  const rimColor = new THREE.Color(rimColorHex);
  const glowColor = new THREE.Color(glowColorHex);

  const noiseGLSL = `
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      uDarkBase: { value: darkBase },
      uBodyColor: { value: bodyColor },
      uRimColor: { value: rimColor },
      uGlowColor: { value: glowColor },
      uCorePos: { value: corePos },
      uKeyLightDir: { value: new THREE.Vector3(16.0, 18.0, 16.0).normalize() },
      uKeyLightColor: { value: new THREE.Color('#fff6ea') },
      uFillLightDir: { value: new THREE.Vector3(-18.0, 10.0, -12.0).normalize() },
      uFillLightColor: { value: new THREE.Color('#55799e') },
      uTime: { value: 0.0 },
      uFresnelPower: { value: isCentral ? 2.6 : 3.0 },
      uSelected: { value: 0.0 },
      uIsCentral: { value: isCentral ? 1.0 : 0.0 },
    },
    vertexShader: `
      ${noiseGLSL}

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;

      uniform float uTime;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vLocalPosition = position;

        // Living biological breathing wave across the surface
        float wave = snoise(position * 0.42 + vec3(0.0, uTime * 0.16, 0.0)) * 0.032;
        vec3 displacedPos = position + normal * wave;

        vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
        vViewPosition = -mvPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      ${noiseGLSL}

      uniform vec3 uDarkBase;
      uniform vec3 uBodyColor;
      uniform vec3 uRimColor;
      uniform vec3 uGlowColor;
      uniform vec3 uCorePos;
      uniform vec3 uKeyLightDir;
      uniform vec3 uKeyLightColor;
      uniform vec3 uFillLightDir;
      uniform vec3 uFillLightColor;
      uniform float uTime;
      uniform float uFresnelPower;
      uniform float uSelected;
      uniform float uIsCentral;

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;

      void main() {
        vec3 V = normalize(vViewPosition);

        // Perturb surface normal with multi-octave 3D noise for biological membrane striations & folds
        float n1 = snoise(vLocalPosition * 1.8 + vec3(0.0, uTime * 0.05, 0.0));
        float n2 = snoise(vLocalPosition * 3.6 + vec3(uTime * 0.07, 0.0, 0.0)) * 0.5;
        vec3 perturbedNormal = normalize(vNormal + vec3(n1, n2, n1 * 0.5) * 0.08);
        vec3 N = perturbedNormal;

        // 1. Dielectric Fresnel reflection curve
        float NdotV = clamp(dot(N, V), 0.0, 1.0);
        float F0 = 0.04;
        float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, uFresnelPower);
        float rimPeak = pow(1.0 - NdotV, 4.8);

        // 2. Translucent Smoked Gemstone Fluid Body
        // Retains rich gemstone coloration, dipping softly into dark obsidian in deep shadow
        vec3 fluidBody = mix(uDarkBase * 1.8, uBodyColor, 0.65 + 0.35 * (1.0 - NdotV));

        // 3. Internal Radiant Light Knot Illumination & Subsurface Forward-Scattering
        // Restrained so the membrane remains translucent, dark, and dimensional without blowing out
        float distToCore = length(vLocalPosition - uCorePos);
        float innerSpread = 1.0 / (1.0 + distToCore * (uIsCentral > 0.5 ? 1.1 : 1.6));
        vec3 innerRadiance = uGlowColor * innerSpread * (uIsCentral > 0.5 ? 0.42 : 0.30);

        // 4. Bioluminescent Fibrous Veils & Caustics (spun silk look from reference)
        float ridge1 = pow(1.0 - abs(snoise(vLocalPosition * 2.8 + vec3(0.0, uTime * 0.04, 0.0))), 3.2);
        float ridge2 = pow(1.0 - abs(snoise(vLocalPosition * 5.4 + vec3(uTime * 0.06, 0.0, 0.0))), 3.8);
        float fibrousVeils = ridge1 * 0.60 + ridge2 * 0.30;
        vec3 causticVeils = mix(uBodyColor, uGlowColor, 0.45) * fibrousVeils * 0.40;

        // 5. Crisp, Luminous Gossamer Fresnel Rim Edge
        vec3 rimHighlight = uRimColor * (fresnel * 0.70 + rimPeak * 0.85);

        // 6. Liquid Clearcoat Specular Sheen
        vec3 L1 = normalize(uKeyLightDir);
        vec3 H1 = normalize(L1 + V);
        float NdotH1 = max(0.0, dot(N, H1));
        float specSharp = pow(NdotH1, 48.0) * 0.55;
        float specSoft = pow(NdotH1, 14.0) * 0.18;

        vec3 L2 = normalize(uFillLightDir);
        vec3 H2 = normalize(L2 + V);
        float specFill = pow(max(0.0, dot(N, H2)), 26.0) * 0.16;

        vec3 clearcoat = uKeyLightColor * (specSharp + specSoft) + uFillLightColor * specFill;

        // Composite final color
        vec3 finalColor = fluidBody + innerRadiance + causticVeils + rimHighlight + clearcoat;

        if (uSelected > 0.0) {
          finalColor += uRimColor * (uSelected * 0.28);
        }

        // Alpha: Semi-transparent in the face so the internal core knot and fibrous filaments shine through!
        // High opacity at grazing angles
        float alphaFace = uIsCentral > 0.5 ? 0.46 : 0.50;
        float alphaRim = 0.95;
        float alpha = mix(alphaFace, alphaRim, pow(1.0 - NdotV, 1.8));

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
  });
}

/**
 * Builds the internal biological filaments & radiant fluid structure inside the translucent body.
 * Features:
 * - Central node: Incandescent star core with horizontal diffraction flare beam
 * - Satellite nodes: Incandescent light knot sprite illuminating the cell from within
 * - Curvilinear biological filaments weaving like spun silk inside the volume
 */
function createInternalFilamentSystem(
  radius: number,
  glowColor: THREE.Color,
  category: LandscapeNode['category'],
  complexity: number,
  phase: number,
  corePos: THREE.Vector3
): { group: THREE.Group; geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; starSprite?: THREE.Sprite; knotSprite?: THREE.Sprite } {
  const internalGroup = new THREE.Group();
  internalGroup.name = 'internal-filaments';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const isCentral = category === 'central_incident';

  // Delicate translucent biological filament material
  const filamentMat = new THREE.MeshBasicMaterial({
    color: isCentral ? new THREE.Color('#f5dcb0') : glowColor,
    transparent: true,
    opacity: isCentral ? 0.88 : 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(filamentMat);

  // Weave 6 to 10 delicate curvilinear filaments from corePos toward the outer membrane
  const filamentCount = isCentral ? 8 : Math.max(5, Math.floor(4 + complexity * 3));

  for (let f = 0; f < filamentCount; f++) {
    const angle = (f / filamentCount) * Math.PI * 2 + phase;
    const rStart = radius * 0.12;
    const rMid = radius * (0.38 + 0.12 * Math.sin(f * 2.2));
    const rEnd = radius * (0.68 + 0.08 * Math.cos(f * 1.7));

    const pStart = corePos.clone().add(new THREE.Vector3(
      Math.cos(angle) * rStart,
      Math.sin(angle * 1.3) * (rStart * 0.4),
      Math.sin(angle) * rStart
    ));

    const pMid = corePos.clone().add(new THREE.Vector3(
      Math.cos(angle + 0.6) * rMid,
      Math.sin(angle * 2.0) * (radius * 0.30),
      Math.sin(angle + 0.6) * rMid
    ));

    const pEnd = corePos.clone().add(new THREE.Vector3(
      Math.cos(angle + 1.2) * rEnd,
      Math.cos(angle * 1.6) * (radius * 0.28),
      Math.sin(angle + 1.2) * rEnd
    ));

    const curve = new THREE.CatmullRomCurve3([pStart, pMid, pEnd], false);
    const tubeRadius = radius * (isCentral ? 0.022 : 0.018);
    const tubeGeom = new THREE.TubeGeometry(curve, 28, tubeRadius, 6, false);
    geometries.push(tubeGeom);

    const mesh = new THREE.Mesh(tubeGeom, filamentMat);
    internalGroup.add(mesh);
  }

  // Radiant Incandescent Star Core for Central Incident
  let starSprite: THREE.Sprite | undefined;
  let knotSprite: THREE.Sprite | undefined;

  if (isCentral) {
    const starTex = getStarTexture();
    const spriteMat = new THREE.SpriteMaterial({
      map: starTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(spriteMat);

    starSprite = new THREE.Sprite(spriteMat);
    starSprite.scale.set(radius * 0.95, radius * 0.95, 1.0);
    starSprite.position.copy(corePos);
    internalGroup.add(starSprite);
  } else {
    // Radiant Incandescent Light Knot for Satellites
    const knotTex = getSatelliteKnotTexture();
    const spriteMat = new THREE.SpriteMaterial({
      map: knotTex,
      color: glowColor,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    materials.push(spriteMat);

    knotSprite = new THREE.Sprite(spriteMat);
    knotSprite.scale.set(radius * 0.72, radius * 0.72, 1.0);
    knotSprite.position.copy(corePos);
    internalGroup.add(knotSprite);
  }

  return { group: internalGroup, geometries, materials, starSprite, knotSprite };
}

/**
 * Constructs a cinematic, Blender/Cycles-quality sculpted translucent organic emotional body.
 * Matches the reference art's translucent fluid membranes, internal volumetric warmth,
 * incandescent cores, and delicate clearcoat sheens.
 */
export function createOrganicNodeMesh(nodeData: LandscapeNode): NodeMeshBundle {
  const group = new THREE.Group();
  group.name = nodeData.id;
  group.position.set(...nodeData.position);

  const { colorSpec, baseRadius, category, shortLabel } = nodeData;
  const isCentral = category === 'central_incident';

  // Calculate local internal core position based on emotional morphology
  const corePos = new THREE.Vector3(0, 0, 0);
  if (isCentral) {
    corePos.set(0.0, baseRadius * 0.10, baseRadius * 0.05);
  } else if (shortLabel.includes('Inner Calm') || category === 'comfort') {
    corePos.set(baseRadius * 0.28, baseRadius * 0.26, baseRadius * 0.10);
  } else if (shortLabel.includes('Focused Mind') || category === 'thought') {
    corePos.set(-baseRadius * 0.25, baseRadius * 0.22, baseRadius * 0.10);
  } else if (shortLabel.includes('Lingering Pressure') || category === 'pressure') {
    corePos.set(-baseRadius * 0.20, -baseRadius * 0.24, baseRadius * 0.10);
  } else if (shortLabel.includes('Gratitude') || nodeData.label.toLowerCase().includes('grat')) {
    corePos.set(0.0, baseRadius * 0.38, baseRadius * 0.10);
  } else if (shortLabel.includes('Quiet Joy') || category === 'emotion') {
    corePos.set(baseRadius * 0.24, baseRadius * 0.12, baseRadius * 0.10);
  } else {
    corePos.set(baseRadius * 0.15, baseRadius * 0.15, baseRadius * 0.08);
  }

  // 1. Crystal-Smooth High-Resolution Geometry (112 x 72 segments = continuous, facet-free curvature)
  const outerGeom = new THREE.SphereGeometry(baseRadius, 112, 72);
  sculptOrganicFluidForm(outerGeom, nodeData, baseRadius);

  const innerColor = new THREE.Color(colorSpec.innerGlowColor);

  // 2. Translucent Fluid Glass Membrane Shader
  const outerMat = createTranslucentMembraneMaterial(
    colorSpec.attenuationColor,
    colorSpec.baseColor,
    colorSpec.rimColor,
    colorSpec.innerGlowColor,
    corePos,
    isCentral
  );

  const outerMesh = new THREE.Mesh(outerGeom, outerMat);
  outerMesh.renderOrder = 10; // Renders on top of internal filaments
  outerMesh.castShadow = false;
  outerMesh.receiveShadow = false;
  (outerMesh as any).nodeData = nodeData;

  // 3. Layered Internal Biological Filaments & Radiant Core (Renders inside)
  const phase = (nodeData.position[0] * 0.73 + nodeData.position[2] * 0.51) % (Math.PI * 2);
  const internalBundle = createInternalFilamentSystem(
    baseRadius,
    innerColor,
    category,
    nodeData.complexity,
    phase,
    corePos
  );

  group.add(internalBundle.group);
  group.add(outerMesh);

  // 4. Subtle, controlled internal point light (dark cinematic mood)
  const pointLight = new THREE.PointLight(
    innerColor,
    isCentral ? 0.50 : 0.24,
    baseRadius * 3.5,
    2.0
  );
  pointLight.position.copy(corePos);
  group.add(pointLight);

  // 5. Animation Loop
  const updateAnimation = (time: number, isReducedMotion: boolean, isSelected: boolean) => {
    const speed = isSelected ? 0.35 : 0.65;
    const t = time * speed;

    const breathAmp = isReducedMotion ? 0.01 : 0.026;
    const breath = 1.0 + Math.sin(t * 0.85 + phase) * breathAmp;

    // Outer membrane slow organic respiration and gentle somatic rocking (anchored to axons, no 360 spin)
    outerMesh.scale.setScalar(breath);
    outerMesh.rotation.y = Math.sin(t * 0.12 + phase) * 0.016;
    outerMesh.rotation.x = Math.sin(t * 0.15 + phase) * 0.014;

    // Update uniform time
    outerMat.uniforms.uTime.value = time;
    outerMat.uniforms.uSelected.value = isSelected ? 1.0 : 0.0;

    // Internal filaments slow parallax undulation
    if (!isReducedMotion) {
      internalBundle.group.position.set(
        Math.sin(t * 0.40 + phase) * 0.05,
        Math.cos(t * 0.48 + phase) * 0.04,
        Math.sin(t * 0.30 + phase) * 0.04
      );
      internalBundle.group.rotation.y = Math.sin(t * 0.15 + phase) * 0.03;

      if (internalBundle.starSprite) {
        const starPulse = 1.0 + Math.sin(t * 1.2 + phase) * 0.05;
        internalBundle.starSprite.scale.set(
          baseRadius * 0.95 * starPulse,
          baseRadius * 0.95 * starPulse,
          1.0
        );
      }

      if (internalBundle.knotSprite) {
        const knotPulse = 1.0 + Math.sin(t * 1.1 + phase) * 0.06;
        internalBundle.knotSprite.scale.set(
          baseRadius * 0.72 * knotPulse,
          baseRadius * 0.72 * knotPulse,
          1.0
        );
      }
    }

    // Dynamic light response on inspection
    if (isSelected) {
      pointLight.intensity = (isCentral ? 1.20 : 0.65) + Math.sin(t * 1.2) * 0.08;
    } else {
      pointLight.intensity = (isCentral ? 0.85 : 0.40) + Math.sin(t * 0.8 + phase) * 0.05;
    }
  };

  const dispose = () => {
    outerGeom.dispose();
    outerMat.dispose();
    internalBundle.geometries.forEach((g) => g.dispose());
    internalBundle.materials.forEach((m) => m.dispose());
    group.clear();
  };

  return {
    group,
    outerMesh,
    pointLight,
    nodeData,
    updateAnimation,
    dispose,
  };
}
