import type { Car } from "@/data/catalog";
import { photoOf, photoSrc } from "@/data/photos";

/**
 * The real car in the showroom: its cutout photo over the asphalt, a ring
 * of light under it when `lit`, and its reflection on the wet floor. Plain
 * markup and CSS — no WebGL involved, so it is the same on every device.
 *
 * Geometry: the car sits in a box that is 80% of the frame's height and
 * 86% of its width, bottom-aligned at 84%. The reflection is the same
 * image flipped, in a box with the very same constraints so it renders at
 * the very same size, clipped to the strip under the car and faded out.
 */
export function CarPhoto({ car, lit = false, className = "", priority = false }: { car: Car; lit?: boolean; className?: string; priority?: boolean }) {
  const photo = photoOf(car);
  if (!photo) return null;
  const src = photoSrc(car);
  return (
    <div className={`car-photo relative aspect-[16/9] w-full select-none ${className}`} data-lit={lit ? "on" : "off"}>
      {/* ring of light */}
      <div
        className={`absolute inset-x-[4%] bottom-[6%] h-[30%] rounded-[50%] transition-opacity duration-500 ${lit ? "opacity-100" : "opacity-30"}`}
        style={{ background: "radial-gradient(closest-side, rgba(42,91,255,0.32) 0%, rgba(42,91,255,0.12) 55%, transparent 72%)" }}
      />
      <div className={`absolute inset-x-[7%] bottom-[8%] h-[24%] rounded-[50%] border transition-all duration-500 ${lit ? "border-bayside/90 shadow-[0_0_30px_rgba(42,91,255,0.55),inset_0_0_30px_rgba(42,91,255,0.25)]" : "border-bayside/25"}`} />
      {/* the car */}
      <div className="absolute inset-x-[7%] top-[4%] h-[80%]">
        <div className="flex h-full w-full items-end justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={car.name} loading={priority ? "eager" : "lazy"} decoding="async" className="car-photo-img max-h-full max-w-full object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.8)] transition-transform duration-500" draggable={false} />
        </div>
      </div>
      {/* reflection on the wet floor: same box, same constraints, flipped, clipped */}
      <div
        className="pointer-events-none absolute inset-x-[7%] top-[84%] h-[22%] overflow-hidden opacity-[0.38]"
        style={{ maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 90%)", WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 90%)" }}
      >
        <div className="flex h-[363.6%] w-full items-start justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden loading="lazy" decoding="async" className="car-photo-img max-h-full max-w-full -scale-y-100 object-contain blur-[1.5px]" draggable={false} />
        </div>
      </div>
    </div>
  );
}
