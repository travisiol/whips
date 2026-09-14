"use client";

import { useEffect, useRef } from "react";
import type { Car } from "@/data/catalog";
import { prefersReducedMotion, useRenderMode } from "@/lib/three/studio";
import { thumbStudio, THUMB_H, THUMB_W } from "@/lib/three/thumbs";
import { CarSvg } from "@/components/CarSvg";

const REST = -0.62; // three-quarter front, nose to the right

/**
 * A die-cast in a card: one frame from the shared studio, redrawn while
 * hovered so the car turns on its plate. `lit` switches the headlamps and
 * the ring of light on — a claimed car is parked under its light, an open
 * bay sits in the dark. Falls back to the flat profile without WebGL.
 */
export function CarThumb({ car, lit = false, spin = false, className = "" }: { car: Car; lit?: boolean; spin?: boolean; className?: string }) {
  const mode = useRenderMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingRef = useRef(REST);

  useEffect(() => {
    if (mode !== "webgl") return;
    const canvas = canvasRef.current;
    const studio = thumbStudio();
    if (!canvas || !studio) return;
    let visible = false;
    let raf = 0;
    let last = 0;
    const still = () => studio.request({ car, target: canvas, heading: headingRef.current, lit });
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) still();
      },
      { rootMargin: "200px" },
    );
    observer.observe(canvas);

    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      headingRef.current += dt * 0.9;
      studio.request({ car, target: canvas, heading: headingRef.current, lit });
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || prefersReducedMotion()) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      // Ease back to the resting heading on the next still frame.
      headingRef.current = REST;
      if (visible) still();
    };
    if (spin) start();
    const host = canvas.parentElement;
    host?.addEventListener("pointerenter", start);
    host?.addEventListener("pointerleave", stop);
    return () => {
      observer.disconnect();
      host?.removeEventListener("pointerenter", start);
      host?.removeEventListener("pointerleave", stop);
      if (raf) cancelAnimationFrame(raf);
      studio.cancel(canvas);
    };
  }, [mode, car, lit, spin]);

  if (mode === "fallback") return <CarSvg car={car} lights={lit} className={className} />;
  return <canvas ref={canvasRef} width={THUMB_W} height={THUMB_H} className={`block w-full ${className}`} style={{ aspectRatio: `${THUMB_W} / ${THUMB_H}` }} aria-label={car.name} role="img" />;
}
