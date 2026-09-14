import * as THREE from "three";
import type { Car } from "@/data/catalog";
import { buildCar, type CarModel } from "./car";
import { createLightRing, createWetFloor } from "./floor";
import { addShowroomLights, createRenderer, createShowroomEnvironment, flakeNormalMap, supportsWebGL } from "./studio";

/**
 * One offscreen renderer for every card in the garage. A card asks for a
 * frame of its car at a heading; the studio renders it into its own canvas
 * and copies the pixels into the card's 2D canvas. Bodies are built once
 * and cached, so scrolling through 120 bays costs one draw per bay, not
 * one WebGL context per bay. Hovered cards ask for frames continuously
 * and get a turntable.
 */
const THUMB_W = 640;
const THUMB_H = 360;

type Job = { car: Car; target: HTMLCanvasElement; heading: number; lit: boolean };

class ThumbStudio {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, THUMB_W / THUMB_H, 0.1, 40);
  private flakes: THREE.Texture;
  private models = new Map<number, CarModel>();
  private ring: THREE.Group;
  private queue: Job[] = [];
  private scheduled = false;

  constructor() {
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    this.renderer = createRenderer(canvas);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(THUMB_W, THUMB_H, false);
    this.scene.environment = createShowroomEnvironment(this.renderer);
    addShowroomLights(this.scene);
    this.flakes = flakeNormalMap();
    this.scene.add(createWetFloor(16, 512, 0.5));
    this.ring = createLightRing(3.1, 0.02);
    this.scene.add(this.ring);
  }

  private model(car: Car): CarModel {
    let m = this.models.get(car.id);
    if (!m) {
      m = buildCar(car, this.flakes);
      this.models.set(car.id, m);
    }
    return m;
  }

  /** Queue a frame; frames are drawn a few per animation frame. */
  request(job: Job) {
    // One pending job per target canvas.
    this.queue = this.queue.filter((j) => j.target !== job.target);
    this.queue.push(job);
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  cancel(target: HTMLCanvasElement) {
    this.queue = this.queue.filter((j) => j.target !== target);
  }

  private flush() {
    this.scheduled = false;
    const start = performance.now();
    while (this.queue.length && performance.now() - start < 12) {
      const job = this.queue.shift()!;
      this.draw(job);
    }
    if (this.queue.length) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  private draw({ car, target, heading, lit }: Job) {
    const model = this.model(car);
    const L = model.length;
    model.group.rotation.y = heading;
    model.setLights(lit);
    this.ring.visible = lit;
    this.ring.scale.setScalar((L * 0.62) / 3.1);
    this.scene.add(model.group);
    const dist = L * 1.28;
    this.camera.position.set(dist * 0.66, L * 0.25, dist * 0.75);
    this.camera.lookAt(0, model.height * 0.4, 0);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(model.group);
    const ctx = target.getContext("2d");
    if (!ctx) return;
    if (target.width !== THUMB_W || target.height !== THUMB_H) {
      target.width = THUMB_W;
      target.height = THUMB_H;
    }
    ctx.clearRect(0, 0, THUMB_W, THUMB_H);
    ctx.drawImage(this.renderer.domElement, 0, 0);
  }
}

let studio: ThumbStudio | null | undefined;

/** The shared studio, or null when WebGL is unavailable. */
export function thumbStudio(): ThumbStudio | null {
  if (studio === undefined) {
    try {
      studio = supportsWebGL() ? new ThumbStudio() : null;
    } catch {
      studio = null;
    }
  }
  return studio;
}

export { THUMB_H, THUMB_W };
