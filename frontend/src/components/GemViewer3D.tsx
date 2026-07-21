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
    color: 0x1a4f96,
    attenuation: 0x0a1e50,
    fire: 0x6baeff,
    name: "Blue Sapphire",
    ior: 1.77,
    attenuationDist: 2.5,
    saturationBoost: 1.2,
  },
  spinel: {
    color: 0xa8234a,
    attenuation: 0x5c0a22,
    fire: 0xff6b8a,
    name: "Spinel",
    ior: 1.72,
    attenuationDist: 2.2,
    saturationBoost: 1.0,
  },
  topaz: {
    color: 0xc48520,
    attenuation: 0x6e4408,
    fire: 0xffe4a0,
    name: "Topaz",
    ior: 1.63,
    attenuationDist: 3.0,
    saturationBoost: 0.8,
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

function buildCutGeometry(
  cutType: string, L: number, W: number, D: number
): THREE.BufferGeometry {
  const scaleMap: Record<string, number> = {
    Round: 0.72, Oval: 0.78, Cushion: 0.80, Emerald: 0.82,
  };
  const s = scaleMap[cutType] ?? 0.80;

  if (cutType === "Cushion") {
    const a = (L/2)*s, b = (W/2)*s, dS = D*s, exp = 3.5;
    return buildSmooth6Ring(
      t => { const c = Math.cos(t); return Math.sign(c) * Math.pow(Math.abs(c), 2/exp); },
      t => { const c = Math.sin(t); return Math.sign(c) * Math.pow(Math.abs(c), 2/exp); },
      a, b, dS
    );
  }
  if (cutType === "Emerald") {
    // Octagonal / rectangular step cut shape
    const a = (L/2)*s, b = (W/2)*s, dS = D*s, exp = 8.0;
    return buildSmooth6Ring(
      t => { const c = Math.cos(t); return Math.sign(c) * Math.pow(Math.abs(c), 2/exp); },
      t => { const c = Math.sin(t); return Math.sign(c) * Math.pow(Math.abs(c), 2/exp); },
      a, b, dS
    );
  }
  if (cutType === "Round") {
    const r = (Math.min(L, W)/2)*s, dS = D*s;
    return buildSmooth6Ring(t => Math.cos(t), t => Math.sin(t), r, r, dS, 16);
  }
 
  // Oval or default
  const a = (L/2)*s, b = (W/2)*s, dS = D*s;
  return buildSmooth6Ring(t => Math.cos(t), t => Math.sin(t), a, b, dS);
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
  const [dispersionEnabled, setDispersionEnabled] = useState(false);

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

    const FIT_XZ = 0.85;
    const L = bbox.x * FIT_XZ;
    const W = bbox.z * FIT_XZ;
    const propDepth = W * 0.58;
    const maxDepth  = bbox.y * 0.80;
    const D = Math.min(propDepth, maxDepth);

    const cutGeom = buildCutGeometry(data.prediction.cut, L, W, D);
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

    // Fit camera
    const maxDim = Math.max(bbox.x, bbox.y, bbox.z, 1);
    const dist = maxDim * 2.5;
    camera.position.set(dist * 0.7, dist * 0.5, dist);
    controls.target.set(0, 0, 0);
    controls.update();

    let animId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (materialRef.current) {
        const t = clock.getElapsedTime();
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
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);

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
  }, [data]);

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

  const preset = GEM_PRESETS[data.gem_type] || GEM_PRESETS.blue_sapphire;
  const { length_mm: L, width_mm: W, depth_mm: D } = data.dimensions;
  const lw = W > 0 ? (L / W).toFixed(2) : "1.00";

  return (
    <div className="relative w-full h-full">
      <div className="hide-nav-footer-trigger hidden" />
      <div ref={containerRef} className="absolute inset-0" />

      {/* Info panel */}
      <div className="absolute top-3 left-3 sm:top-6 sm:left-6 bg-[rgba(15,18,30,0.82)] backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-5 max-w-[11rem] sm:max-w-xs z-10 shadow-2xl">
        <span className="inline-block text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-blue-600 mb-1.5 sm:mb-2 font-medium">
          AI Predicted
        </span>
        <p className="font-semibold text-xs sm:text-sm opacity-60">Gem Type:</p>
        <p className="text-[11px] sm:text-sm mb-1 sm:mb-3 truncate font-bold text-white">
          {preset.name}
        </p>
        <p className="font-semibold text-xs sm:text-sm opacity-60">Suggested Optimal Cut:</p>
        <p className="text-[11px] sm:text-sm mb-2 sm:mb-4 truncate font-bold text-blue-300">
          {data.prediction.cut}
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-3 text-[11px] sm:text-sm border-t border-white/10 pt-2 sm:pt-3">
          <div><div className="text-[9px] sm:text-xs opacity-50 uppercase">Length</div><div className="font-semibold">{L.toFixed(2)} mm</div></div>
          <div><div className="text-[9px] sm:text-xs opacity-50 uppercase">Width</div><div className="font-semibold">{W.toFixed(2)} mm</div></div>
          <div><div className="text-[9px] sm:text-xs opacity-50 uppercase">Depth</div><div className="font-semibold">{D.toFixed(2)} mm</div></div>
          <div><div className="text-[9px] sm:text-xs opacity-50 uppercase">L/W</div><div className="font-semibold">{lw}</div></div>
          <div><div className="text-[9px] sm:text-xs opacity-50 uppercase">Yield</div><div className="font-semibold">{data.prediction.yield_pct.toFixed(1)}%</div></div>
          {data.prediction.confidence !== undefined && (
            <div><div className="text-[9px] sm:text-xs opacity-50 uppercase">Conf.</div><div className="font-semibold">{data.prediction.confidence.toFixed(0)}%</div></div>
          )}
        </div>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-black/40 hover:bg-red-600 backdrop-blur-md border border-white/20 text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-sm sm:text-base transition-all z-10 cursor-pointer shadow-lg active:scale-95"
        >
          ✕
        </button>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-3 sm:bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-4xl sm:w-auto bg-[rgba(15,18,30,0.85)] backdrop-blur-md border border-white/10 rounded-xl px-3 sm:px-6 py-2.5 sm:py-3.5 z-10 shadow-2xl">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {/* View controls */}
          <div className="flex gap-1.5 sm:gap-2 items-center text-[11px] sm:text-sm">
            <span className="opacity-60 text-[10px] sm:text-xs font-medium uppercase tracking-wider">View:</span>
            {(["cut", "overlay", "rough"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer font-medium ${
                  view === v ? "bg-blue-600 text-white shadow-md" : "border border-white/15 hover:bg-white/10 text-white/80"
                }`}
              >
                {v === "cut" ? "Cut" : v === "overlay" ? "R+Cut" : "Rough"}
                <span className="hidden sm:inline">{v === "cut" ? " Only" : v === "overlay" ? "" : " Only"}</span>
              </button>
            ))}
          </div>

          <div className="hidden sm:block w-px h-6 bg-white/10" />

          {/* Look controls */}
          <div className="flex gap-1.5 sm:gap-2 items-center text-[11px] sm:text-sm">
            <span className="opacity-60 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Look:</span>
            {(["clean", "natural"] as LookMode[]).map((l) => (
              <button
                key={l}
                onClick={() => setLook(l)}
                className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg transition cursor-pointer font-medium ${
                  look === l ? "bg-blue-600 text-white shadow-md" : "border border-white/15 hover:bg-white/10 text-white/80"
                }`}
              >
                {l === "clean" ? "Clean" : "Natural"}
              </button>
            ))}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg transition cursor-pointer font-medium ${
                autoRotate ? "bg-blue-600 text-white shadow-md" : "border border-white/15 hover:bg-white/10 text-white/80"
              }`}
            >
              {autoRotate ? "Auto" : "Manual"}
            </button>
          </div>

          <div className="hidden sm:block w-px h-6 bg-white/10" />

          {/* FX controls */}
          <div className="flex gap-1.5 sm:gap-2 items-center text-[11px] sm:text-sm">
            <span className="opacity-60 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Bloom:</span>
            <button
              onClick={() => setBloomEnabled(!bloomEnabled)}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg transition cursor-pointer font-medium ${
                bloomEnabled ? "bg-blue-600 text-white shadow-md" : "border border-white/15 hover:bg-white/10 text-white/80"
              }`}
            >
              {bloomEnabled ? "On" : "Off"}
            </button>
          </div>

          <div className="flex gap-1.5 sm:gap-2 items-center text-[11px] sm:text-sm">
            <span className="opacity-60 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Dispersion:</span>
            <button
              onClick={() => setDispersionEnabled(!dispersionEnabled)}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg transition cursor-pointer font-medium ${
                dispersionEnabled ? "bg-blue-600 text-white shadow-md" : "border border-white/15 hover:bg-white/10 text-white/80"
              }`}
            >
              {dispersionEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}