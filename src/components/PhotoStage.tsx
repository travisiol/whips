"use client";

import { useEffect, useRef, useState } from "react";
import { CarPhoto } from "@/components/CarPhoto";
import { CarStage } from "@/components/CarStage";
import type { Car } from "@/data/catalog";
import { photoOf } from "@/data/photos";
import { prefersReducedMotion } from "@/lib/three/studio";

/**
 * The car on the sheet: its real photo under the ring of light. Headlamps
 * (the ring) come on when hovered or when `lit`; `exit` drives the car out
 * of the showroom to the right and fires `onExited` when it is gone. Cars
 * without a photo get the generated die-cast on the 3D turntable.
 */
export function PhotoStage({ car, lit = false, exit = false, onExited, className = "" }: { car: Car; lit?: boolean; exit?: boolean; onExited?: () => void; className?: string }) {
  const [hover, setHover] = useState(false);
  const exitedRef = useRef(onExited);
  useEffect(() => {
    exitedRef.current = onExited;
  }, [onExited]);
  useEffect(() => {
    if (!exit) return;
    const t = setTimeout(() => exitedRef.current?.(), prefersReducedMotion() ? 200 : 950);
    return () => clearTimeout(t);
  }, [exit]);

  if (!photoOf(car)) return <CarStage car={car} lights={lit} exit={exit} onExited={onExited} className={className} />;

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <div className={`w-[92%] max-w-[720px] ${exit ? "drive-out" : ""}`}>
        <CarPhoto car={car} lit={lit || hover || exit} priority />
      </div>
    </div>
  );
}
