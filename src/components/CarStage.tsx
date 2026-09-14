"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Car } from "@/data/catalog";
import { buildCar, rollWheels } from "@/lib/three/car";
import { createWetFloor } from "@/lib/three/floor";
import { BAYSIDE, addShowroomLights, createRenderer, createShowroomEnvironment, darkSteel, disposeScene, flakeNormalMap, observeSize, prefersReducedMotion, runLoop, useRenderMode } from "@/lib/three/studio";
import { CarSvg } from "@/components/CarSvg";

/**
 * One die-cast on a slowly turning plate, wet floor under it. Hover (or
 * `lights`) switches the headlamps on. `exit` drives the car out of the
 * showroom to the right — the launch moment — and `onExited` fires once it
 * has left the frame. Falls back to the flat profile without WebGL; paints
 * a single still frame under reduced motion.
 */
export function CarStage({
  car,
  lights = false,
  exit = false,
  onExited,
  className = "",
  spin = true,
}: {
  car: Car;
  lights?: boolean;
  exit?: boolean;
  onExited?: () => void;
  className?: string;
  spin?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useRenderMode();
  const exitRef = useRef(exit);
  const lightsRef = useRef(lights);
  const exitedRef = useRef(onExited);
  // The render loop reads these through refs so prop changes never rebuild the scene.
  useEffect(() => {
    exitRef.current = exit;
    lightsRef.current = lights;
    exitedRef.current = onExited;
  }, [exit, lights, onExited]);

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
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    const flakes = flakeNormalMap();

    const model = buildCar(car, flakes);
    const L = model.length;
    const plate = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.66, L * 0.7, 0.06, 96), darkSteel());
    disc.position.y = 0.03;
    plate.add(disc);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(L * 0.66, 0.018, 10, 160),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(BAYSIDE).multiplyScalar(2), toneMapped: false }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.062;
    plate.add(rim);
    const ringLight = new THREE.PointLight(BAYSIDE, 4, L * 3, 2);
    ringLight.position.set(0, 0.3, 0);
    plate.add(ringLight);
    model.group.position.y = 0.06;
    plate.add(model.group);
    scene.add(plate);
    scene.add(createWetFloor(L * 5, 768, 0.5));

    const body = model.group.getObjectByName("body") as THREE.Mesh;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-10, -10);
    let hover = false;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };
    const onLeave = () => pointer.set(-10, -10);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    let aspect = 1;
    const stopSize = observeSize(host, (w, h) => {
      aspect = w / h;
      renderer.setSize(w, h, false);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    });

    const reduced = prefersReducedMotion();
    let heading = -0.55; // radians around y; the car's nose starts three-quarters toward the camera
    let exitX = 0;
    let exitSpeed = 0;
    let exited = false;
    let lit = false;
    const target = new THREE.Vector3(0, model.height * 0.34, 0);

    const stopLoop = runLoop(
      canvas,
      (_time, dt) => {
        const exiting = exitRef.current;
        if (dt > 0) {
          if (!exiting && spin) heading += dt * 0.28;
          if (exiting) {
            // Straighten toward +x, then floor it.
            const wrapped = ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const toZero = wrapped > Math.PI ? Math.PI * 2 - wrapped : -wrapped;
            if (Math.abs(toZero) > 0.02) heading += toZero * Math.min(1, dt * 6);
            else {
              exitSpeed += dt * (L * 3.2);
              exitX += exitSpeed * dt;
              rollWheels(model, exitSpeed * dt);
              if (exitX > L * 3.2 && !exited) {
                exited = true;
                exitedRef.current?.();
              }
            }
          }
        }
        plate.rotation.y = heading;
        model.group.position.x = exitX;

        // A low three-quarter view, so the flank and the profile read, not the roof.
        const wide = aspect >= 1.2;
        const dist = L * (wide ? 1.55 : 2.1) * (aspect < 0.8 ? 1.25 : 1);
        camera.position.set(dist * 0.6, L * 0.24, dist * 0.8);
        camera.lookAt(target);

        raycaster.setFromCamera(pointer, camera);
        hover = raycaster.intersectObject(body, false).length > 0;
        const wantLit = hover || lightsRef.current || exiting;
        if (wantLit !== lit) {
          lit = wantLit;
          model.setLights(lit);
        }
        canvas.style.cursor = hover ? "pointer" : "";
        renderer.render(scene, camera);
      },
      !reduced || exit,
    );

    return () => {
      stopLoop();
      stopSize();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      model.dispose();
      disposeScene(scene);
      flakes.dispose();
      envMap.dispose();
      renderer.dispose();
    };
    // The exit flag is read through a ref so a launch does not rebuild the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, car.id, spin]);

  // Fallback drive-out: the SVG slides right on its own (and under reduced
  // motion the 3D car simply leaves without the animation).
  useEffect(() => {
    if (!exit || (mode !== "fallback" && !prefersReducedMotion())) return;
    const t = setTimeout(() => exitedRef.current?.(), mode === "fallback" ? 900 : 300);
    return () => clearTimeout(t);
  }, [mode, exit]);

  return (
    <div ref={hostRef} className={`relative ${className}`} role="img" aria-label={`${car.name} die-cast on a turntable`}>
      {mode === "fallback" ? (
        <div className={`flex h-full w-full items-center justify-center ${exit ? "drive-out" : ""}`}>
          <CarSvg car={car} lights={lights || exit} className="w-[92%]" />
        </div>
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}
