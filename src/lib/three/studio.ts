import * as THREE from "three";
import { useSyncExternalStore } from "react";

/*
  three.js plumbing for the showroom. Everything here is painted at runtime —
  there is no texture, model or HDR file to load.
*/

export const BAYSIDE = 0x2a5bff;
export const BAYSIDE_RGB = "42, 91, 255";

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/**
 * A showroom at night, for paint and chrome: a black room, two white
 * softboxes (key top-left, fill right), a long thin strip overhead for the
 * specular line along the roof, and one ribbon of Bayside Blue low behind
 * the subject so every edge carries the site's only accent.
 */
export function createShowroomEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.BackSide })));

  const panel = (w: number, h: number, color: number, intensity: number, x: number, y: number, z: number) => {
    const material = new THREE.MeshBasicMaterial();
    material.color.set(color).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  panel(7, 4, 0xffffff, 6, -5, 7, 5); // key softbox
  panel(4, 6, 0xffffff, 2.2, 8, 2, 4); // fill softbox, right
  panel(14, 0.5, 0xffffff, 6, 0, 9, -1); // thin overhead strip → the long roof highlight
  panel(10, 6, 0xffffff, 0.7, 0, 1.5, 11); // broad soft panel behind the camera, so the flanks read as metal, not black
  panel(12, 2, 0xffffff, 0.35, 0, -7, 4); // floor bounce
  panel(16, 1.2, BAYSIDE, 9, -2, -3, -9); // the blue ribbon, low and behind
  panel(5, 1, BAYSIDE, 3, 9, -2, -4); // a faint blue kicker on the far side

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  disposeScene(scene);
  return target.texture;
}

/** Metallic flake for the clearcoat: a tiled speckle normal map painted on a canvas. */
export function flakeNormalMap(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgb(128,128,255)";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const nx = 128 + (Math.random() - 0.5) * 90;
      const ny = 128 + (Math.random() - 0.5) * 90;
      ctx.fillStyle = `rgb(${nx | 0},${ny | 0},235)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 3);
  return texture;
}

export function paintMaterial(hex: string, flakes: THREE.Texture): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    metalness: 0.4,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    clearcoatNormalMap: flakes,
    clearcoatNormalScale: new THREE.Vector2(0.22, 0.22),
    envMapIntensity: 1.5,
  });
}

export function chrome(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdadee6,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
  });
}

export function darkSteel(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: 0x2a2d36, metalness: 0.9, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.1 });
}

export function glassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0a0e18,
    metalness: 0.25,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.6,
  });
}

export function rubber(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x0b0c0f, metalness: 0.05, roughness: 0.88 });
}

/** Key / rim lights on top of the environment, so shapes keep their volume. */
export function addShowroomLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(BAYSIDE, 30, 18, 2);
  rim.position.set(0, 0.8, -4.5);
  scene.add(rim);
  const kicker = new THREE.PointLight(0xffffff, 8, 14, 2);
  kicker.position.set(4, 3, 2.5);
  scene.add(kicker);
}

/** Soft radial glow as a texture, for light spill on the floor. */
export function radialGlowTexture(rgb: string, alpha: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    gradient.addColorStop(0.45, `rgba(${rgb}, ${alpha * 0.3})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function glowPlane(texture: THREE.Texture, size: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Calls `cb` now (synchronously — the first frame must never wait on an observer) and on every size change of `el`. */
export function observeSize(el: HTMLElement, cb: (width: number, height: number) => void): () => void {
  const emit = () => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) cb(rect.width, rect.height);
  };
  const observer = new ResizeObserver(emit);
  observer.observe(el);
  window.addEventListener("resize", emit);
  emit();
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", emit);
  };
}

/**
 * requestAnimationFrame loop that only runs while the canvas is on screen and
 * the tab is visible. With `animate = false` it renders a single frame — the
 * reduced-motion path.
 */
export function runLoop(canvas: HTMLCanvasElement, render: (time: number, dt: number) => void, animate: boolean): () => void {
  let raf = 0;
  let running = false;
  let visible = true;
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    render(now / 1000, dt);
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    const should = animate && visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
    },
    { threshold: 0 },
  );
  observer.observe(canvas);
  document.addEventListener("visibilitychange", sync);

  // Always paint one frame right away, so a static viewer sees the object.
  render(0, 0);
  sync();

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
    cancelAnimationFrame(raf);
    running = false;
  };
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const key of ["map"] as const) {
          const tex = (material as unknown as Record<string, unknown>)[key];
          if (tex instanceof THREE.Texture) tex.dispose();
        }
        material.dispose();
      }
    }
  });
}

let renderMode: "webgl" | "fallback" | null = null;
const noSubscribe = () => () => {};
const readRenderMode = () => (renderMode ??= supportsWebGL() ? "webgl" : "fallback");
const serverRenderMode = () => "pending" as const;

/** "pending" on the server and during hydration, then "webgl" or "fallback" — decided once per page. */
export function useRenderMode(): "pending" | "webgl" | "fallback" {
  return useSyncExternalStore(noSubscribe, readRenderMode, serverRenderMode);
}
