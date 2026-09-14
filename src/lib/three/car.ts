import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { Car } from "@/data/catalog";
import { GROUND, profileFor } from "@/lib/profile";
import { bodySpec, buildBodyGeometry, type BodySpec } from "./body";
import { chrome, darkSteel, glassMaterial, paintMaterial, rubber } from "./studio";

/**
 * The die-cast miniature. The body is lofted from the car's real
 * dimensions and its side profile (see body.ts): paint below the beltline,
 * dark glazing above it, a rounded roof. Wheels are tyre + chrome dish +
 * five spokes sitting in dark wells; a wing when the car has one; lamps
 * front and rear that can be switched on. One unit is one metre; the car
 * stands on y = 0, nose toward +x.
 */
export type CarModel = {
  group: THREE.Group;
  spec: BodySpec;
  /** Length in world units. */
  length: number;
  width: number;
  height: number;
  wheels: THREE.Object3D[];
  setLights: (on: boolean) => void;
  dispose: () => void;
};

const loader = new SVGLoader();
const geometryCache = new Map<number, { geometry: THREE.BufferGeometry; spec: BodySpec; wing: THREE.BufferGeometry | null }>();

/** Wing outline (profile units) → extruded, y up, centred, in world units. */
function wingGeometry(car: Car, spec: BodySpec): THREE.BufferGeometry | null {
  const p = profileFor(car);
  if (!p.wing) return null;
  const sx = spec.length / 192;
  const sy = (spec.height * 0.985) / (GROUND - p.top);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path transform="matrix(1 0 0 -1 -100 ${GROUND})" d="${p.wing}"/></svg>`;
  const shapes = loader.parse(svg).paths.flatMap((path) => path.toShapes());
  const depth = spec.width * 0.9;
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: depth / sx, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.4, bevelSegments: 2, curveSegments: 6 });
  geometry.translate(0, 0, -depth / sx / 2);
  geometry.scale(sx, sy, sx);
  return geometry;
}

/** Body geometry per car, built once and shared between scenes. */
function cachedBody(car: Car) {
  const hit = geometryCache.get(car.id);
  if (hit) return hit;
  const spec = bodySpec(car);
  const entry = { geometry: buildBodyGeometry(spec), spec, wing: wingGeometry(car, spec) };
  geometryCache.set(car.id, entry);
  return entry;
}

export function buildCar(car: Car, flakes: THREE.Texture): CarModel {
  const { geometry, spec, wing } = cachedBody(car);
  const { length: L, width: W } = spec;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const paint = paintMaterial(car.paint, flakes);
  const glass = glassMaterial();
  const chromeMat = chrome();
  const steel = darkSteel();
  const tyre = rubber();
  const well = new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0.1, roughness: 0.95 });
  disposables.push(paint, glass, chromeMat, steel, tyre, well);

  const body = new THREE.Mesh(geometry, [paint, glass, well]);
  body.name = "body";
  group.add(body);

  if (wing) group.add(new THREE.Mesh(wing, paint));

  // Wheels: tyre, dark well, chrome lip, dish, five spokes, hub — two per axle.
  const wheels: THREE.Object3D[] = [];
  for (const w of spec.wheels) {
    const r = w.r;
    const tw = r * 0.8;
    const tyreGeom = new THREE.CylinderGeometry(r, r, tw, 40, 1);
    tyreGeom.rotateX(Math.PI / 2);
    const wellGeom = new THREE.CylinderGeometry(r + 0.07, r + 0.07, tw * 0.9, 40, 1);
    wellGeom.rotateX(Math.PI / 2);
    const dishGeom = new THREE.CylinderGeometry(r * 0.64, r * 0.64, tw * 0.7, 32, 1);
    dishGeom.rotateX(Math.PI / 2);
    const lipGeom = new THREE.TorusGeometry(r * 0.66, r * 0.035, 8, 48);
    const spokeGeom = new THREE.BoxGeometry(r * 0.15, r * 0.56, tw * 0.5);
    const hubGeom = new THREE.CylinderGeometry(r * 0.15, r * 0.15, tw * 0.9, 16, 1);
    hubGeom.rotateX(Math.PI / 2);
    disposables.push(tyreGeom, wellGeom, dishGeom, lipGeom, spokeGeom, hubGeom);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      wheel.position.set(w.x, r, side * (W / 2 - tw / 2 + 0.012));
      wheel.add(new THREE.Mesh(tyreGeom, tyre));
      const dish = new THREE.Mesh(dishGeom, steel);
      dish.position.z = side * tw * 0.1;
      wheel.add(dish);
      const lip = new THREE.Mesh(lipGeom, chromeMat);
      lip.position.z = side * tw * 0.42;
      wheel.add(lip);
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(spokeGeom, chromeMat);
        spoke.rotation.z = (i / 5) * Math.PI * 2;
        spoke.position.set(-Math.sin(spoke.rotation.z) * r * 0.31, Math.cos(spoke.rotation.z) * r * 0.31, side * tw * 0.22);
        wheel.add(spoke);
      }
      const hub = new THREE.Mesh(hubGeom, chromeMat);
      hub.position.z = side * tw * 0.08;
      wheel.add(hub);
      group.add(wheel);
      wheels.push(wheel);
      // The well does not spin with the wheel.
      const arch = new THREE.Mesh(wellGeom, well);
      arch.position.set(w.x, r, side * (W / 2 + 0.004 - (tw * 0.9) / 2));
      group.add(arch);
    }
  }

  // Lamps at the corners of the nose and tail.
  const lampGeom = new THREE.BoxGeometry(0.05, 0.07, 0.22);
  disposables.push(lampGeom);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, emissive: 0xfff2c8, emissiveIntensity: 0, roughness: 0.2, metalness: 0.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0d12, emissive: 0xff2a2a, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.2 });
  disposables.push(headMat, tailMat);
  const headLights: THREE.PointLight[] = [];
  const headX = L / 2 - 0.03;
  const tailX = -L / 2 + 0.03;
  const headY = Math.min(spec.head[1], spec.top(headX) - 0.05);
  const tailY = Math.min(spec.tail[1], spec.top(tailX) - 0.05);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(lampGeom, headMat);
    head.position.set(headX, headY, side * (spec.half(headX) - 0.15));
    group.add(head);
    const tail = new THREE.Mesh(lampGeom, tailMat);
    tail.position.set(tailX, tailY, side * (spec.half(tailX) - 0.15));
    group.add(tail);
    const beam = new THREE.PointLight(0xfff0c0, 0, L * 0.8, 2);
    beam.position.set(headX + 0.25, headY, side * (spec.half(headX) - 0.15));
    group.add(beam);
    headLights.push(beam);
  }

  const setLights = (on: boolean) => {
    headMat.emissiveIntensity = on ? 2.4 : 0;
    tailMat.emissiveIntensity = on ? 1.6 : 0.15;
    for (const l of headLights) l.intensity = on ? 2.2 : 0;
  };

  return {
    group,
    spec,
    length: L,
    width: W,
    height: spec.height,
    wheels,
    setLights,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

/** Spin the wheels for `distance` world units of travel. */
export function rollWheels(model: CarModel, distance: number): void {
  const radius = model.spec.wheels[0]?.r ?? 0.33;
  for (const w of model.wheels) w.rotation.z -= distance / radius;
}
