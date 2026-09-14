"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CAR_BY_SLUG, type Car } from "@/data/catalog";
import { buildCar, rollWheels, type CarModel } from "@/lib/three/car";
import { photoOf, photoSrc } from "@/data/photos";
import { CarPhoto } from "@/components/CarPhoto";
import { createLightRing, createWetFloor } from "@/lib/three/floor";
import { addShowroomLights, createRenderer, createShowroomEnvironment, disposeScene, flakeNormalMap, observeSize, prefersReducedMotion, runLoop, useRenderMode } from "@/lib/three/studio";
import { createWordmark } from "@/lib/three/wordmark";
import { site } from "@/lib/site";
import { CarSvg } from "@/components/CarSvg";

/** The three miniatures that orbit the ring under the wordmark. */
const ORBIT = ["f40", "r34", "countach"] as const;
const RING = 2.55;

/**
 * The hero: the chrome wordmark with its speed trail, three die-casts
 * orbiting the ring of light, all standing on wet asphalt. Hovering a car
 * switches its headlamps on. Without WebGL the same composition is drawn
 * with the display font and the flat profiles; with reduced motion the
 * scene is painted once and left still.
 */
export function HeroScene({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useRenderMode();

  useEffect(() => {
    if (mode !== "webgl") return;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = createRenderer(canvas);
    const scene = new THREE.Scene();
    const envMap = createShowroomEnvironment(renderer);
    scene.environment = envMap;
    addShowroomLights(scene);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    const flakes = flakeNormalMap();

    const floor = createWetFloor(22, Math.min(1024, Math.round(1024 * Math.min(window.devicePixelRatio || 1, 2) * 0.5)), 0.6);
    scene.add(floor);
    scene.add(createLightRing(RING));

    const wordmark = createWordmark(site.name, 1.25);
    wordmark.group.position.set(0, 1.95, -0.3);
    wordmark.group.rotation.set(-0.18, -0.2, 0.03);
    scene.add(wordmark.group);

    // The three cars on the ring: their real photos, standing on the wet
    // floor like cutouts at a car show (a generated die-cast when a car
    // has no photo). Each one turns to face the camera every frame.
    const cars: { car: Car; phase: number; object: THREE.Object3D; model: CarModel | null; hit: THREE.Object3D }[] = [];
    const textureLoader = new THREE.TextureLoader();
    ORBIT.forEach((slug, i) => {
      const car = CAR_BY_SLUG.get(slug)!;
      const phase = (i / ORBIT.length) * Math.PI * 2;
      if (photoOf(car)) {
        const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, toneMapped: false });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), material);
        plane.position.y = 0.55;
        plane.visible = false;
        textureLoader.load(photoSrc(car), (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          const aspect = tex.image.width / tex.image.height;
          const h = 1.05;
          plane.geometry.dispose();
          plane.geometry = new THREE.PlaneGeometry(h * aspect, h);
          plane.position.y = h / 2 - 0.02;
          material.map = tex;
          material.needsUpdate = true;
          plane.visible = true;
        });
        const holder = new THREE.Group();
        holder.add(plane);
        scene.add(holder);
        cars.push({ car, phase, object: holder, model: null, hit: plane });
      } else {
        const model = buildCar(car, flakes);
        model.group.scale.setScalar(0.5);
        scene.add(model.group);
        cars.push({ car, phase, object: model.group, model, hit: model.group.getObjectByName("body") as THREE.Mesh });
      }
    });

    const bodies = cars.map((c) => c.hit);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-10, -10);
    let hovered = -1;
    let parallax = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      parallax = { x: pointer.x, y: pointer.y };
    };
    const onLeave = () => {
      pointer.set(-10, -10);
      parallax = { x: 0, y: 0 };
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    let aspect = 1;
    const camTarget = new THREE.Vector3(0, 1.05, 0);
    const rest = new THREE.Vector3(0, 3.6, 9.2);
    // The camera's resting place depends on the aspect: narrow screens back
    // off so the ring fits. Set synchronously so the first frame is framed.
    const placeCamera = () => {
      const narrow = aspect < 1;
      rest.set(0, narrow ? 4.4 : 3.2, narrow ? 12 : aspect < 1.5 ? 10 : 8.6);
      // Portrait frames look at the ring itself so the wordmark's reflection stays inside the canvas.
      camTarget.set(0, narrow ? 0.7 : 1.05, 0);
    };
    const stopSize = observeSize(host, (w, h) => {
      aspect = w / h;
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      placeCamera();
      camera.position.copy(rest);
      camera.lookAt(camTarget);
    });

    const reduced = prefersReducedMotion();
    let angle = reduced ? 0.9 : 0;
    const placeCars = () => {
      for (const c of cars) {
        const a = angle + c.phase;
        c.object.position.set(RING * Math.cos(a), 0, RING * Math.sin(a));
        if (c.model) c.object.rotation.y = -a - Math.PI / 2;
        else c.object.lookAt(camera.position.x, 0, camera.position.z);
      }
    };
    placeCars();

    const stopLoop = runLoop(
      canvas,
      (time, dt) => {
        if (dt > 0) {
          const dAngle = dt * 0.14;
          angle += dAngle;
          placeCars();
          for (const c of cars) if (c.model) rollWheels(c.model, RING * dAngle * (1 / 0.5));
          wordmark.update(time);
          wordmark.group.position.y = 1.95 + Math.sin(time * 0.8) * 0.05;
          wordmark.group.rotation.z = 0.03 + Math.sin(time * 0.5) * 0.015;
        }
        // Ease toward the resting place plus a little pointer parallax.
        camera.position.x += (rest.x + parallax.x * 0.6 - camera.position.x) * 0.06;
        camera.position.y += (rest.y + parallax.y * 0.3 - camera.position.y) * 0.06;
        camera.position.z += (rest.z - camera.position.z) * 0.08;
        camera.lookAt(camTarget);

        placeCars();
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(bodies, false)[0];
        const idx = hit ? bodies.indexOf(hit.object) : -1;
        if (idx !== hovered) {
          const off = hovered >= 0 ? cars[hovered] : null;
          const on = idx >= 0 ? cars[idx] : null;
          off?.model?.setLights(false);
          on?.model?.setLights(true);
          if (off && !off.model) off.object.scale.setScalar(1);
          if (on && !on.model) on.object.scale.setScalar(1.06);
          hovered = idx;
          canvas.style.cursor = idx >= 0 ? "pointer" : "";
        }
        renderer.render(scene, camera);
      },
      !reduced,
    );

    return () => {
      stopLoop();
      stopSize();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      for (const c of cars) {
        c.model?.dispose();
        if (!c.model) {
          const plane = c.hit as THREE.Mesh;
          plane.geometry.dispose();
          const m = plane.material as THREE.MeshBasicMaterial;
          m.map?.dispose();
          m.dispose();
        }
      }
      wordmark.dispose();
      disposeScene(scene);
      flakes.dispose();
      envMap.dispose();
      renderer.dispose();
    };
  }, [mode]);

  return (
    <div ref={hostRef} className={`relative ${className}`} aria-label={`${site.name} wordmark with three cars on a ring of light`} role="img">
      {mode === "fallback" ? <HeroFallback /> : <canvas ref={canvasRef} className="block h-full w-full" />}
    </div>
  );
}

/** No WebGL: the same composition with the display face and the flat profiles. */
function HeroFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end pb-6">
      <div className="display text-[18vw] leading-none text-chrome sm:text-[9rem]" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.25)" }}>
        {site.name}
      </div>
      <div className="ring-line mt-2 h-32 w-[88%] rounded-[50%]" />
      <div className="-mt-28 flex w-full items-end justify-center gap-4 px-6">
        {ORBIT.map((slug) => {
          const car = CAR_BY_SLUG.get(slug)!;
          return photoOf(car) ? <CarPhoto key={slug} car={car} lit className="w-1/3 max-w-[260px]" /> : <CarSvg key={slug} car={car} className="w-1/3 max-w-[220px]" />;
        })}
      </div>
    </div>
  );
}
