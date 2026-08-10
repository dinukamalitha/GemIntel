"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export interface GemData {
  stone_id?: string;
  gem_type: string;
  dimensions: { length_mm: number; width_mm: number; depth_mm: number };
  prediction: {
    cut: string;
    yield_pct: number;
    confidence?: number;
    probabilities?: Record<string, number>;
    cut_yields?: Record<string, number>;
  };
  rough_bbox?: { x: number; y: number; z: number };
  rough_mesh?: {
    vertices: number[];
    indices: number[];
    vertex_count: number;
    face_count: number;
  };
}

type ViewMode = "cut" | "overlay" | "rough";
type LookMode = "clean" | "natural";

interface GemPreset {
  color: number;
  attenuation: number;
  fire: number;
  name: string;
  ior: number;
  attenuationDist: number;
  saturationBoost: number;
}

const GEM_PRESETS: Record<string, GemPreset> = {
  blue_sapphire: {
    color: 0x124076,
    attenuation: 0x081c3c,
    fire: 0x60a5fa,
    name: "Blue Sapphire",
    ior: 1.77,
    attenuationDist: 2.5,
    saturationBoost: 1.2,
  },
  spinel: {
    color: 0x1e3a8a,
    attenuation: 0x0f172a,
    fire: 0x818cf8,
    name: "Blue Spinel",
    ior: 1.72,
    attenuationDist: 2.2,
    saturationBoost: 1.1,
  },
  blue_spinel: {
    color: 0x1e3a8a,
    attenuation: 0x0f172a,
    fire: 0x818cf8,
    name: "Blue Spinel",
    ior: 1.72,
    attenuationDist: 2.2,
    saturationBoost: 1.1,
  },
  topaz: {
    color: 0x0284c7,
    attenuation: 0x0369a1,
    fire: 0x38bdf8,
    name: "Blue Topaz",
    ior: 1.63,
    attenuationDist: 3.0,
    saturationBoost: 0.9,
  },
  blue_topaz: {
    color: 0x0284c7,
    attenuation: 0x0369a1,
    fire: 0x38bdf8,
    name: "Blue Topaz",
    ior: 1.63,
    attenuationDist: 3.0,
    saturationBoost: 0.9,
  },
};

function buildSmooth6Ring(
  rxFn: (t: number) => number,
  ryFn: (t: number) => number,
  a: number,
  b: number,
  dS: number,
  n = 12
): THREE.BufferGeometry {
  // 8 height rings for facet detail (table, star, bezel, girdle, upper pavilion, lower pavilion, near-culet, culet)
  const zt = dS * 0.45, zs = dS * 0.32, zc = dS * 0.15, zg = 0;
  const zp1 = -dS * 0.18, zp2 = -dS * 0.34, zp3 = -dS * 0.46, zcu = -dS * 0.52;
  const scales  = [0.48, 0.68, 0.88, 1.00, 0.68, 0.38, 0.15, 0.04];
  const heights = [zt,   zs,   zc,   zg,   zp1,  zp2,  zp3,  zcu];
  const RINGS = scales.length;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < RINGS; r++) {
    const sR = scales[r];
    const z = heights[r];
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * Math.PI * 2;
      const rx = a * rxFn(theta);
      const ry = b * ryFn(theta);
      positions.push(sR * rx, z, sR * ry);
    }
  }
  positions.push(0, zt, 0);
  const topCenter = RINGS * n;
  positions.push(0, zcu, 0);
  const botCenter = RINGS * n + 1;

  for (let r = 0; r < RINGS - 1; r++) {
    const rA = r * n, rB = (r + 1) * n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      indices.push(rA + i, rB + i, rB + j);
      indices.push(rA + i, rB + j, rA + j);
    }
  }
  // Top cap (table)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(topCenter, j, i);
  }
  // Bottom cap (culet)
  const last = (RINGS - 1) * n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(botCenter, last + i, last + j);
  }

  // Build indexed geometry, then convert to non-indexed
  // so every triangle gets its own flat face normal (= faceted look)
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);

  const geom = indexed.toNonIndexed();   // duplicate verts per-face
  geom.computeVertexNormals();           // now normals are per-face
  indexed.dispose();
  return geom;
}

function getIntelligentCutFit(
  cutType: string,
  dimensions: { length_mm: number; width_mm: number; depth_mm: number },
  rough_bbox?: { x: number; y: number; z: number },
  yieldPct?: number
): { L: number; W: number; D: number; s: number; exp?: number; cornerFactor: number } {
  const bbox = rough_bbox ?? {
    x: dimensions.length_mm,
    y: dimensions.depth_mm,
    z: dimensions.width_mm,
  };

  // 1. Dynamic yield-based cubic linear calibration:
  // In physics/gemology, linear volume scales with (yield_pct / 100)^(1/3).
  // Calibrated to the balanced lapidary envelope (~68-70% effective fill)
  const baseYield = yieldPct && yieldPct > 0 ? yieldPct : 28.0;
  const dynamicLinearScale = Math.cbrt(baseYield / 100) * 1.25;
  const FIT_XZ = Math.min(0.85, Math.max(0.78, dynamicLinearScale));

  const L = bbox.x * FIT_XZ;
  const W = bbox.z * FIT_XZ;

  // 2. Per-Cut optimal facet proportion and corner normalization:
  let s = 0.80;
  let exp: number | undefined = undefined;
  let cornerFactor = 1.0;

  if (cutType === "Cushion") {
    exp = 3.2;
    // Super-ellipse corner expansion normalization factor ~1.14
    cornerFactor = Math.pow(2, 0.5 - 1 / exp);
    s = 0.80;
  } else if (cutType === "Emerald") {
    exp = 6.0;
    // Rectangular/octagonal corner factor ~1.26
    cornerFactor = Math.pow(2, 0.5 - 1 / exp);
    s = 0.78;
  } else if (cutType === "Round") {
    cornerFactor = 1.0;
    s = 0.80;
  } else {
    // Oval / Brilliant
    cornerFactor = 1.0;
    s = 0.81;
  }

  // 3. Proportional depth constraint (ideal pavilion 41° + crown 34° ~ 56% of width)
  const propDepth = W * 0.56;
  const maxDepth = bbox.y * 0.74;
  const D = Math.min(propDepth, maxDepth);

  return { L, W, D, s, exp, cornerFactor };
}

function buildCutGeometry(
  cutType: string,
  fit: { L: number; W: number; D: number; s: number; exp?: number; cornerFactor: number }
): THREE.BufferGeometry {
  const { L, W, D, s, exp, cornerFactor } = fit;

  if (cutType === "Cushion" && exp) {
    const a = ((L / 2) * s) / cornerFactor;
    const b = ((W / 2) * s) / cornerFactor;
    const dS = D * s;
    return buildSmooth6Ring(
      (t) => {
        const c = Math.cos(t);
        return Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
      },
      (t) => {
        const c = Math.sin(t);
        return Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
      },
      a,
      b,
      dS
    );
  }

  if (cutType === "Emerald" && exp) {
    const a = ((L / 2) * s) / cornerFactor;
    const b = ((W / 2) * s) / cornerFactor;
    const dS = D * s;
    return buildSmooth6Ring(
      (t) => {
        const c = Math.cos(t);
        return Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
      },
      (t) => {
        const c = Math.sin(t);
        return Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
      },
      a,
      b,
      dS
    );
  }

  if (cutType === "Round") {
    const r = (Math.min(L, W) / 2) * s;
    const dS = D * s;
    return buildSmooth6Ring((t) => Math.cos(t), (t) => Math.sin(t), r, r, dS, 16);
  }

  // Oval or default
  const a = (L / 2) * s;
  const b = (W / 2) * s;
  const dS = D * s;
  return buildSmooth6Ring((t) => Math.cos(t), (t) => Math.sin(t), a, b, dS);
}

// ZONING TEXTURE (natural color banding + silk inclusions)
function makeZoningTexture(baseColorHex: number, boost: number = 1.0): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = new THREE.Color(baseColorHex);
  const r = Math.floor(base.r * 255);
  const g = Math.floor(base.g * 255);
  const b = Math.floor(base.b * 255);

  // Base fill
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Angular growth zoning bands
  for (let i = 0; i < 20; i++) {
    const lighter = Math.random() > 0.45;
    const intensity = (lighter ? 35 : -30) * boost;
    const rr = Math.max(0, Math.min(255, r + intensity));
    const gg = Math.max(0, Math.min(255, g + intensity * 0.7));
    const bb = Math.max(0, Math.min(255, b + intensity + 15));
    const alpha = 0.08 + Math.random() * 0.14;
    ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha})`;
    ctx.save();
    ctx.translate(Math.random() * size, Math.random() * size);
    ctx.rotate((Math.random() - 0.5) * 2.0);
    const bw = 60 + Math.random() * 140;
    const bh = 8 + Math.random() * 18;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }

  // Subtle hexagonal zoning
  for (let i = 0; i < 6; i++) {
    const cx = size / 2 + (Math.random() - 0.5) * 80;
    const cy = size / 2 + (Math.random() - 0.5) * 80;
    const radius = 40 + Math.random() * 80;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const lighter = Math.random() > 0.5;
    const s = lighter ? 25 : -20;
    grad.addColorStop(0, `rgba(${r+s},${g+s},${b+s},0.12)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.strokeStyle = `rgba(255,255,255,0.04)`;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 30; i++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const angle = (Math.floor(Math.random() * 3) * 60) * (Math.PI / 180);
    const len = 15 + Math.random() * 40;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const CUT_ICONS: Record<string, React.ReactNode> = {
  Round: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <polygon points="12,3 15.5,8.5 12,12 8.5,8.5" />
      <polygon points="21,12 15.5,15.5 12,12 15.5,8.5" />
      <polygon points="12,21 8.5,15.5 12,12 15.5,15.5" />
      <polygon points="3,12 8.5,8.5 12,12 8.5,15.5" />
    </svg>
  ),
  Oval: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="7" ry="9.5" />
      <ellipse cx="12" cy="12" rx="3.5" ry="5" />
      <polygon points="12,2.5 15,7.5 12,12 9,7.5" />
      <polygon points="19,12 15,16.5 12,12 15,7.5" />
      <polygon points="12,21.5 9,16.5 12,12 15,16.5" />
      <polygon points="5,12 9,7.5 12,12 9,16.5" />
    </svg>
  ),
  Cushion: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" strokeWidth="1.5">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <line x1="3.5" y1="8" x2="7" y2="9" />
      <line x1="3.5" y1="16" x2="7" y2="15" />
      <line x1="20.5" y1="8" x2="17" y2="9" />
      <line x1="20.5" y1="16" x2="17" y2="15" />
      <line x1="8" y1="3.5" x2="9" y2="7" />
      <line x1="16" y1="3.5" x2="15" y2="7" />
      <line x1="8" y1="20.5" x2="9" y2="17" />
      <line x1="16" y1="20.5" x2="15" y2="17" />
    </svg>
  ),
  Emerald: (
    <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 stroke-current fill-none" strokeWidth="1.5">
      <polygon points="5,3 19,3 21,5 21,19 19,21 5,21 3,19 3,5" />
      <polygon points="7,6 17,6 18,7 18,17 17,18 7,18 6,17 6,7" />
      <line x1="3" y1="5" x2="6" y2="7" />
      <line x1="21" y1="5" x2="18" y2="7" />
      <line x1="21" y1="19" x2="18" y2="17" />
      <line x1="3" y1="19" x2="6" y2="17" />
    </svg>
  ),
};

export default function GemViewer3D({
  data,
  onClose,
}: {
  data: GemData;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewMode>("overlay");
  const [look, setLook] = useState<LookMode>("clean");
  const [autoRotate, setAutoRotate] = useState(true);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [dispersionEnabled, setDispersionEnabled] = useState(true);
  const [prevCut, setPrevCut] = useState<string | undefined>(data.prediction.cut);
  const [selectedCut, setSelectedCut] = useState<string>(data.prediction.cut || "Oval");
  const [showInsight, setShowInsight] = useState<boolean>(false);

  if (data.prediction.cut !== prevCut) {
    setPrevCut(data.prediction.cut);
    setSelectedCut(data.prediction.cut || "Oval");
  }

  const preset = GEM_PRESETS[data.gem_type] || GEM_PRESETS.blue_sapphire;
  const { length_mm: L, width_mm: W, depth_mm: D } = data.dimensions;

  const sceneRef     = useRef<THREE.Scene | null>(null);
  const cutMeshRef   = useRef<THREE.Mesh | null>(null);
  const cutEdgesRef  = useRef<THREE.LineSegments | null>(null);
  const roughMeshRef = useRef<THREE.Mesh | null>(null);
  const roughWfRef   = useRef<THREE.LineSegments | null>(null);
  const inclusionsRef = useRef<THREE.Points | null>(null);
  const materialRef  = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const zoningTexRef = useRef<THREE.CanvasTexture | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef  = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      35, container.clientWidth / container.clientHeight, 0.1, 100
    );
    camera.position.set(8, 6, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.background = new THREE.Color(0x111827);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x020206);

    const softboxGeom = new THREE.PlaneGeometry(5, 5);
    const softboxMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.9, 1.8), side: THREE.DoubleSide });
    const softbox = new THREE.Mesh(softboxGeom, softboxMat);
    softbox.position.set(0, 7, 0);
    softbox.rotation.x = Math.PI / 2;
    envScene.add(softbox);

    const stripGeom = new THREE.PlaneGeometry(4, 0.5);
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.6, 2.0), side: THREE.DoubleSide });
    const strip = new THREE.Mesh(stripGeom, stripMat);
    strip.position.set(0, 3, 6);
    strip.lookAt(0, 0, 0);
    envScene.add(strip);

    const sideWarmGeom = new THREE.PlaneGeometry(1.5, 2);
    const sideWarmMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.2, 0.6), side: THREE.DoubleSide });
    const sideWarm = new THREE.Mesh(sideWarmGeom, sideWarmMat);
    sideWarm.position.set(-6, 2, -1);
    sideWarm.lookAt(0, 0, 0);
    envScene.add(sideWarm);

    const sideCoolGeom = new THREE.PlaneGeometry(1.2, 2.5);
    const sideCoolMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.7, 1.8), side: THREE.DoubleSide });
    const sideCool = new THREE.Mesh(sideCoolGeom, sideCoolMat);
    sideCool.position.set(6, 1, 1);
    sideCool.lookAt(0, 0, 0);
    envScene.add(sideCool);

    const rearHLGeom = new THREE.PlaneGeometry(2, 1);
    const rearHLMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.1, 1.5), side: THREE.DoubleSide });
    const rearHL = new THREE.Mesh(rearHLGeom, rearHLMat);
    rearHL.position.set(0, 4, -6);
    rearHL.lookAt(0, 0, 0);
    envScene.add(rearHL);

    const envFloorGeom = new THREE.PlaneGeometry(20, 20);
    const envFloorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.01, 0.01, 0.015), side: THREE.DoubleSide });
    const envFloor = new THREE.Mesh(envFloorGeom, envFloorMat);
    envFloor.position.set(0, -5, 0);
    envFloor.rotation.x = -Math.PI / 2;
    envScene.add(envFloor);

    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // Clean up temporary environment meshes
    [softboxGeom, stripGeom, sideWarmGeom, sideCoolGeom, rearHLGeom, envFloorGeom].forEach(g => g.dispose());
    [softboxMat, stripMat, sideWarmMat, sideCoolMat, rearHLMat, envFloorMat].forEach(m => m.dispose());

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.35,
      0.25,
      0.82
    );
    composer.addPass(bloomPass);

    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const key = new THREE.DirectionalLight(0xfff5e6, 1.5);
    key.position.set(4, 8, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc0d4ff, 0.5);
    fill.position.set(-5, 3, -3);
    scene.add(fill);

    const pavilionGlow = new THREE.PointLight(0xffffff, 0.1, 10);
    pavilionGlow.position.set(0, -4, 0);
    scene.add(pavilionGlow);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.minDistance = 4;
    controls.maxDistance = 25;
    controlsRef.current = controls;

    const preset = GEM_PRESETS[data.gem_type] || GEM_PRESETS.blue_sapphire;

    // Safe bounding box fallback
    const bbox = data.rough_bbox ?? {
      x: data.dimensions.length_mm,
      y: data.dimensions.depth_mm,
      z: data.dimensions.width_mm,
    };

    const initialYield = data.prediction.cut_yields?.[data.prediction.cut] ?? data.prediction.yield_pct;
    const fit = getIntelligentCutFit(data.prediction.cut, data.dimensions, data.rough_bbox, initialYield);
    const cutGeom = buildCutGeometry(data.prediction.cut, fit);
    const zoningTex = makeZoningTexture(preset.color, preset.saturationBoost);
    zoningTexRef.current = zoningTex;

    const cutMat = new THREE.MeshPhysicalMaterial({
      color:                new THREE.Color(preset.color),
      metalness:            0.0,
      roughness:            0.02,
      flatShading:          false,
      transmission:         0.88,
      thickness:            4.0,
      ior:                  preset.ior,
      attenuationColor:     new THREE.Color(preset.attenuation),
      attenuationDistance:  preset.attenuationDist,
      clearcoat:            1.0,
      clearcoatRoughness:   0.01,
      specularIntensity:    2.0,
      specularColor:        new THREE.Color(preset.fire),
      sheen:                0.0,
      envMapIntensity:      1.2,
      side:                 THREE.DoubleSide,
    });
    materialRef.current = cutMat;

    const cutMesh = new THREE.Mesh(cutGeom, cutMat);
    cutMeshRef.current = cutMesh;
    scene.add(cutMesh);

    const edgesGeom = new THREE.EdgesGeometry(cutGeom, 8);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x88bbff, transparent: true, opacity: 0.12 });
    const cutEdges = new THREE.LineSegments(edgesGeom, edgesMat);
    cutEdgesRef.current = cutEdges;
    scene.add(cutEdges);

    // Rough mesh (from backend JSON)
    if (data.rough_mesh?.vertices?.length) {
      const roughGeom = new THREE.BufferGeometry();
      roughGeom.setAttribute("position", new THREE.Float32BufferAttribute(data.rough_mesh.vertices, 3));
      roughGeom.setIndex(data.rough_mesh.indices);
      roughGeom.computeVertexNormals();

      const roughMat = new THREE.MeshPhysicalMaterial({
        color: 0x8da9d4,
        metalness: 0.0,
        roughness: 0.55,
        transmission: 0.75,
        thickness: 0.3,
        opacity: 0.20,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const roughMesh = new THREE.Mesh(roughGeom, roughMat);
      roughMeshRef.current = roughMesh;
      scene.add(roughMesh);

      const wfGeom = new THREE.WireframeGeometry(roughGeom);
      const wfMat = new THREE.LineBasicMaterial({ color: 0xa8c4ff, transparent: true, opacity: 0.15 });
      const roughWf = new THREE.LineSegments(wfGeom, wfMat);
      roughWfRef.current = roughWf;
      scene.add(roughWf);
    }

    // Inclusions
    const incCount = 120;
    const incPositions: number[] = [];
    const ia = (L/2) * 0.78 * 0.65;
    const ib = (W/2) * 0.78 * 0.65;
    const ic = (D    * 0.78) * 0.30;
    for (let i = 0; i < incCount; i++) {
      let x, y, z;
      do {
        x = Math.random()*2 - 1;
        y = Math.random()*2 - 1;
        z = Math.random()*2 - 1;
      } while (x*x + y*y + z*z > 1);
      incPositions.push(x*ia, y*ic, z*ib);
    }
    const incGeom = new THREE.BufferGeometry();
    incGeom.setAttribute("position", new THREE.Float32BufferAttribute(incPositions, 3));
    const incMat = new THREE.PointsMaterial({
      color: 0xc8d8ff, size: 0.025, transparent: true,
      opacity: 0.22, sizeAttenuation: true,
    });
    const inc = new THREE.Points(incGeom, incMat);
    inc.visible = false;
    inclusionsRef.current = inc;
    scene.add(inc);

    // Floor surface
    const floorGeom = new THREE.CircleGeometry(15, 64);
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c1018,
      metalness: 0.08,
      roughness: 0.82,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    scene.add(floor);

    // Fit camera based on aspect ratio to prevent clipping and offset on mobile
    const maxDim = Math.max(bbox.x, bbox.y, bbox.z, 1);
    const aspect = container.clientWidth / container.clientHeight;
    const isMobile = aspect < 1;
    // Scale distance based on screen aspect ratio so the gem is fully visible inside viewport
    const fitFactor = isMobile ? Math.max(1.35, 1.45 / aspect) : 1.0;
    const dist = maxDim * 2.8 * fitFactor;

    camera.position.set(dist * 0.65, dist * (isMobile ? 0.42 : 0.5), dist * 0.95);
    // Center gem in the available visible space between top card and bottom toolbar
    controls.target.set(0, isMobile ? -0.2 : 0.1, 0);
    controls.update();

    let animId: number;
    const startTime = performance.now();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (materialRef.current) {
        const t = (performance.now() - startTime) / 1000;
        const flicker =
          1.0 +
          0.06 * Math.sin(t * 2.3) +
          0.04 * Math.sin(t * 5.7 + 1.2) +
          0.02 * Math.sin(t * 11.1 + 0.7);
        materialRef.current.envMapIntensity = 1.2 * flicker;
      }

      composer.render();
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);

      const curAspect = w / h;
      const curIsMobile = curAspect < 1;
      const curFit = curIsMobile ? Math.max(1.35, 1.45 / curAspect) : 1.0;
      const curDist = maxDim * 2.8 * curFit;
      camera.position.set(curDist * 0.65, curDist * (curIsMobile ? 0.42 : 0.5), curDist * 0.95);
      controls.target.set(0, curIsMobile ? -0.2 : 0.1, 0);
      controls.update();
    };

    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();

      // Deep GPU Memory Disposal
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments || (obj as THREE.Points).isPoints) {
          const meshObj = obj as THREE.Mesh;
          if (meshObj.geometry) meshObj.geometry.dispose();
          if (meshObj.material) {
            if (Array.isArray(meshObj.material)) {
              meshObj.material.forEach((m) => m.dispose());
            } else {
              meshObj.material.dispose();
            }
          }
        }
      });

      if (envTex) envTex.dispose();
      if (zoningTex) zoningTex.dispose();

      if (composerRef.current) {
        composerRef.current.passes.forEach((p) => {
          if ("dispose" in p && typeof p.dispose === "function") {
            p.dispose();
          }
        });
        composerRef.current.dispose();
        composerRef.current = null;
      }
      bloomPassRef.current = null;

      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
    };
  }, [D, L, W, data]);

  useEffect(() => {
    if (cutMeshRef.current)   cutMeshRef.current.visible   = view !== "rough";
    if (cutEdgesRef.current)  cutEdgesRef.current.visible  = view !== "rough";
    if (roughMeshRef.current) roughMeshRef.current.visible = view !== "cut";
    if (roughWfRef.current)   roughWfRef.current.visible   = view !== "cut";
    if (inclusionsRef.current) {
      inclusionsRef.current.visible = (look === "natural") && (view !== "rough");
    }
  }, [view, look]);

  useEffect(() => {
    if (!cutMeshRef.current || !cutEdgesRef.current) return;
  
    const activeYield = data.prediction.cut_yields?.[selectedCut] ?? data.prediction.yield_pct;
    const fit = getIntelligentCutFit(selectedCut, data.dimensions, data.rough_bbox, activeYield);
    const newCutGeom = buildCutGeometry(selectedCut, fit);

    if (cutMeshRef.current.geometry) cutMeshRef.current.geometry.dispose();
    cutMeshRef.current.geometry = newCutGeom;

    if (cutEdgesRef.current.geometry) cutEdgesRef.current.geometry.dispose();
    cutEdgesRef.current.geometry = new THREE.EdgesGeometry(newCutGeom, 8);
  }, [selectedCut, data]);

  useEffect(() => {
    const mat = materialRef.current;
    const tex = zoningTexRef.current;
    if (!mat) return;

    const preset = GEM_PRESETS[data.gem_type] || GEM_PRESETS.blue_sapphire;

    if (look === "natural") {
      mat.map = tex;
      mat.roughness = 0.05;
      mat.clearcoat = 0.85;
      mat.clearcoatRoughness = 0.05;
      mat.transmission = 0.80;
      mat.thickness = 4.5;
      mat.attenuationDistance = preset.attenuationDist * 0.7;
      mat.envMapIntensity = 0.9;
      mat.sheen = 0.0;
    } else {
      mat.map = null;
      mat.roughness = 0.02;
      mat.clearcoat = 1.0;
      mat.clearcoatRoughness = 0.01;
      mat.transmission = 0.88;
      mat.thickness = 4.0;
      mat.attenuationDistance = preset.attenuationDist;
      mat.envMapIntensity = 1.2;
      mat.sheen = 0.0;
    }

    // Apply dispersion to physical material
    mat.dispersion = dispersionEnabled ? 0.05 : 0.0;

    // Apply bloom toggle
    if (bloomPassRef.current) {
      bloomPassRef.current.enabled = bloomEnabled;
    }

    mat.needsUpdate = true;
  }, [look, data.gem_type, bloomEnabled, dispersionEnabled]);


  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  // Dual-Target Cut Analytics (Industry-Grade Matching)
  const cutYields = data.prediction.cut_yields || {};
  const bestShapeCut = data.prediction.cut || "Round";
  const bestShapeYield = cutYields[bestShapeCut] ?? data.prediction.yield_pct;

  // Find the shape that maximizes raw weight retention
  let maxYieldCut = bestShapeCut;
  let maxYieldVal = -1;
  ["Round", "Oval", "Cushion", "Emerald"].forEach((cut) => {
    const yVal = cutYields[cut];
    if (yVal !== undefined && yVal > maxYieldVal) {
      maxYieldVal = yVal;
      maxYieldCut = cut;
    }
  });

  const isDualMatch = bestShapeCut.toLowerCase() === maxYieldCut.toLowerCase();
  const safeLength = Math.max(L, W);
  const safeWidth = Math.min(L, W);
  const lwRatio = safeWidth > 0 ? safeLength / safeWidth : 1.0;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#05070e] text-white overflow-hidden select-none">
      <div className="hide-nav-footer-trigger hidden" />

      {/* Floating Top Glass Island Bar */}
      <div className="absolute top-2.5 sm:top-5 left-1/2 -translate-x-1/2 z-30 w-[95%] sm:w-[96%] max-w-5xl pointer-events-auto">
        <div className="relative bg-[rgba(13,18,32,0.88)] backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-2.5 sm:p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-3">
          
          {/* Mobile/Desktop Left Section: Gem Info & Close Button */}
          <div className="flex items-center justify-between gap-2">
            {/* 1. Left Card: Gem Info, Dimensions & Dual-Target Badges */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-base sm:text-xl shadow-[0_0_12px_rgba(59,130,246,0.25)] flex-shrink-0">
                💎
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight leading-tight truncate">
                    {preset.name}
                  </span>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 hidden sm:inline-block">
                    ML Predicted
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInsight(!showInsight)}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1"
                    title="Toggle Lapidary AI Optimization Insight"
                  >
                    <span>🧠</span>
                    <span className="hidden sm:inline">Cutter Insight</span>
                  </button>
                </div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-medium leading-tight mt-0.5">
                  {L.toFixed(2)} × {W.toFixed(2)} × {D.toFixed(2)} mm
                </div>

                {/* Industry Dual-Target Badges */}
                {isDualMatch ? (
                  <div className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-1 shadow-sm">
                    <span>★ Optimal:</span>
                    <span className="text-white font-extrabold">{bestShapeCut}</span>
                    <span className="text-emerald-400 font-extrabold">({bestShapeYield.toFixed(1)}%)</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1">
                    <div 
                      title="Best Optical Symmetry & Commercial Value" 
                      className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shadow-sm"
                    >
                      <span>💎 Best Value:</span>
                      <span className="text-white font-extrabold">{bestShapeCut}</span>
                      <span className="text-blue-300 font-extrabold">({bestShapeYield.toFixed(1)}%)</span>
                    </div>
                    <div 
                      title="Maximum Raw Crystal Mass Retention" 
                      className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shadow-sm"
                    >
                      <span>⚖️ Max Yield:</span>
                      <span className="text-white font-extrabold">{maxYieldCut}</span>
                      <span className="text-emerald-400 font-extrabold">({maxYieldVal.toFixed(1)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Close button (Mobile top-right) */}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-slate-400 hover:text-white bg-white/5 hover:bg-red-500/20 border border-white/10 p-1.5 rounded-xl transition cursor-pointer md:hidden flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Divider (Desktop Only) */}
          <div className="hidden md:block w-px h-10 bg-white/10 flex-shrink-0" />

          {/* 2. Center: 4 Cut Shape Cards (Responsive 4-Col Grid on Mobile, Flex on Desktop) */}
          <div className="grid grid-cols-4 md:flex md:items-center gap-1.5 sm:gap-2 w-full md:w-auto pt-1 sm:pt-1">
            {["Round", "Oval", "Cushion", "Emerald"].map((cutName) => {
              const yieldVal = data.prediction.cut_yields?.[cutName];
              const isBestShape = cutName.toLowerCase() === bestShapeCut.toLowerCase();
              const isMaxYield = cutName.toLowerCase() === maxYieldCut.toLowerCase();
              const isSelected = cutName.toLowerCase() === selectedCut?.toLowerCase();

              // Badge logic
              let badgeConfig: { label: string; activeClass: string; idleClass: string } | null = null;
              if (isDualMatch && isBestShape) {
                badgeConfig = {
                  label: "★ Optimal",
                  activeClass: "bg-emerald-400 text-slate-950 ring-1 ring-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
                  idleClass: "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40",
                };
              } else if (!isDualMatch && isBestShape) {
                badgeConfig = {
                  label: "💎 Best Value",
                  activeClass: "bg-blue-400 text-slate-950 ring-1 ring-blue-300 shadow-[0_0_8px_rgba(96,165,250,0.6)]",
                  idleClass: "bg-blue-500/25 text-blue-300 border border-blue-400/40",
                };
              } else if (!isDualMatch && isMaxYield) {
                badgeConfig = {
                  label: "⚖️ Max Yield",
                  activeClass: "bg-emerald-400 text-slate-950 ring-1 ring-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
                  idleClass: "bg-emerald-500/25 text-emerald-300 border border-emerald-400/40",
                };
              }

              return (
                <button
                  key={cutName}
                  type="button"
                  onClick={() => setSelectedCut(cutName)}
                  className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2.5 px-1 sm:px-2 md:w-20 rounded-xl sm:rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600/25 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.35)] ring-1 ring-blue-400/60 scale-[1.02]"
                      : isBestShape
                        ? "bg-blue-950/20 border-blue-500/40 text-slate-200 hover:border-blue-400/70"
                        : isMaxYield
                          ? "bg-emerald-950/20 border-emerald-500/40 text-slate-200 hover:border-emerald-400/70"
                          : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] text-slate-300 hover:text-white"
                  }`}
                >
                  {/* Distinct Target Badges */}
                  {badgeConfig && (
                    <span className={`absolute -top-2 px-1 sm:px-1.5 py-0.5 rounded-full text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-wider shadow-sm transition-all whitespace-nowrap ${
                      isSelected ? badgeConfig.activeClass : badgeConfig.idleClass
                    }`}>
                      {badgeConfig.label}
                    </span>
                  )}

                  {/* Selected Checkmark Badge */}
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[7px] sm:text-[8px] font-black shadow-sm">
                      ✓
                    </span>
                  )}

                  <div className={`mb-0.5 sm:mb-1 transition-transform ${
                    isSelected 
                      ? "text-blue-400 scale-110" 
                      : isBestShape 
                        ? "text-blue-300" 
                        : isMaxYield 
                          ? "text-emerald-300" 
                          : "text-slate-400"
                  }`}>
                    {CUT_ICONS[cutName] || CUT_ICONS.Oval}
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold leading-tight truncate">{cutName}</span>
                  <span className={`text-[9px] sm:text-[11px] font-bold leading-tight mt-0.5 ${
                    isSelected 
                      ? "text-blue-200" 
                      : isBestShape 
                        ? "text-blue-300" 
                        : isMaxYield 
                          ? "text-emerald-400" 
                          : "text-slate-400"
                  }`}>
                    {yieldVal !== undefined ? `${yieldVal.toFixed(1)}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* AI Cutter Insight Popover Modal */}
          {showInsight && (
            <div className="absolute top-[calc(100%+10px)] left-2 right-2 sm:left-4 sm:w-[440px] bg-[rgba(10,14,24,0.96)] backdrop-blur-2xl border border-blue-500/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-3.5 sm:p-4 z-50 animate-fade-in text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧠</span>
                  <span className="text-xs font-black uppercase tracking-wider text-blue-300">
                    Lapidary AI Cutter Rationale
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInsight(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-0.5 hover:bg-white/10 rounded-lg transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-900/80 rounded-xl p-2.5 border border-white/5 flex items-center justify-between">
                  <div className="text-slate-300 text-[11px]">
                    Crystal Geometry: <strong className="text-white font-mono">{L.toFixed(2)} × {W.toFixed(2)} × {D.toFixed(2)} mm</strong>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded font-mono font-bold">
                    L/W: {lwRatio.toFixed(2)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-400/25">
                  <div className="font-bold text-blue-300 flex items-center gap-1.5 mb-1 text-[11px]">
                    <span>💎 Best Value & Optical Match:</span>
                    <span className="text-white font-extrabold">{bestShapeCut} ({bestShapeYield.toFixed(1)}%)</span>
                  </div>
                  <p className="text-slate-300 text-[10.5px] leading-relaxed">
                    {lwRatio <= 1.15
                      ? `The equant aspect ratio (L/W ${lwRatio.toFixed(2)}) is the gold standard for ${bestShapeCut} faceting, producing maximum brilliance, optical symmetry, and high per-carat market value.`
                      : `The rough proportions (L/W ${lwRatio.toFixed(2)}) provide ideal face-up spread and balance for a ${bestShapeCut} cut.`}
                  </p>
                </div>

                {!isDualMatch && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/25">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1 text-[11px]">
                      <span>⚖️ Maximum Mass Retention:</span>
                      <span className="text-white font-extrabold">{maxYieldCut} ({maxYieldVal.toFixed(1)}%)</span>
                    </div>
                    <p className="text-slate-300 text-[10.5px] leading-relaxed">
                      {maxYieldCut === "Cushion"
                        ? `Cushion contours preserve corner bulk from blocky crystals, saving +${(maxYieldVal - bestShapeYield).toFixed(1)}% more raw weight compared to ${bestShapeCut}.`
                        : `${maxYieldCut} cut minimizes sawing/grinding waste (+${(maxYieldVal - bestShapeYield).toFixed(1)}% raw weight retained).`}
                    </p>
                  </div>
                )}

                <div className="text-[9.5px] text-slate-400 border-t border-white/5 pt-2 flex items-start gap-1.5 leading-relaxed">
                  <span className="shrink-0 mt-0.5">💡</span>
                  <span><strong>Industry Standard:</strong> Gem cutters select <strong>{bestShapeCut}</strong> for premium per-carat pricing and brilliance, or <strong>{maxYieldCut}</strong> to maintain highest finished carat weight tiers.</span>
                </div>
              </div>
            </div>
          )}

          {/* Divider (Desktop Only) */}
          <div className="hidden md:block w-px h-10 bg-white/10 flex-shrink-0" />

          {/* 3. Right: Desktop View Mode & Quick Toggles */}
          <div className="hidden md:flex flex-col items-end gap-1.5 flex-shrink-0 pr-6 sm:pr-8">
            
            {/* View Mode Toggle Capsule */}
            <div className="flex items-center bg-black/40 border border-white/10 rounded-full p-0.5">
              {(["cut", "overlay", "rough"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold transition cursor-pointer ${
                    view === v
                      ? "bg-white/20 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {v === "cut" ? "Cut" : v === "overlay" ? "Overlay" : "Rough"}
                </button>
              ))}
            </div>

            {/* Look & FX Text Toggles */}
            <div className="flex items-center gap-2.5 text-[10px] sm:text-xs font-medium text-slate-400">
              <button
                onClick={() => setLook(look === "clean" ? "natural" : "clean")}
                className="hover:text-white transition cursor-pointer"
              >
                Look: <span className="text-blue-400 font-bold">{look === "clean" ? "Clean" : "Natural"}</span>
              </button>

              <button
                onClick={() => setBloomEnabled(!bloomEnabled)}
                className="hover:text-white transition cursor-pointer"
              >
                Bloom: <span className="text-blue-400 font-bold">{bloomEnabled ? "On" : "Off"}</span>
              </button>

              <button
                onClick={() => setDispersionEnabled(!dispersionEnabled)}
                className="hover:text-white transition cursor-pointer"
              >
                Fire: <span className="text-blue-400 font-bold">{dispersionEnabled ? "On" : "Off"}</span>
              </button>

              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className="hover:text-white transition cursor-pointer"
              >
                Auto: <span className="text-blue-400 font-bold">{autoRotate ? "On" : "Off"}</span>
              </button>
            </div>

          </div>

          {/* Desktop Close Button (Top right corner of pill) */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="hidden md:block absolute top-2.5 right-2.5 sm:top-3 sm:right-3.5 text-slate-400 hover:text-white hover:bg-white/10 p-1 rounded-full transition cursor-pointer z-10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

        </div>
      </div>

      {/* Floating Bottom Toolbar (Mobile Only: Easy Thumb Access) */}
      <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-xs pointer-events-auto">
        <div className="bg-[rgba(13,18,32,0.92)] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl px-3 py-2 flex items-center justify-between gap-2">
          
          {/* View Mode Toggle Capsule */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-full p-0.5">
            {(["cut", "overlay", "rough"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                  view === v
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {v === "cut" ? "Cut" : v === "overlay" ? "Overlay" : "Rough"}
              </button>
            ))}
          </div>

          {/* Mobile Quick Toggles */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLook(look === "clean" ? "natural" : "clean")}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                look === "natural"
                  ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-slate-300"
              }`}
            >
              {look === "clean" ? "Clean" : "Natural"}
            </button>

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              title="Toggle Auto-Rotation"
              className={`p-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                autoRotate
                  ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              🔄
            </button>

            <button
              onClick={() => setBloomEnabled(!bloomEnabled)}
              title="Toggle Bloom Glow"
              className={`p-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                bloomEnabled
                  ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              ✨
            </button>

            <button
              onClick={() => setDispersionEnabled(!dispersionEnabled)}
              title="Toggle Fire / Spectral Dispersion"
              className={`p-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                dispersionEnabled
                  ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-slate-400"
              }`}
            >
              🌈
            </button>
          </div>

        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <main className="flex-1 w-full h-full relative min-h-0">
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0 [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:block"
        />

        {/* Small subtle helper text at bottom corner (Desktop only) */}
        <div className="hidden md:flex absolute bottom-3 left-3 pointer-events-none bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-slate-400 items-center gap-1.5">
          <span>🖱️</span> Drag to rotate • Scroll to zoom • Right-click to pan
        </div>
      </main>
    </div>
  );
}
