import { useId } from "react";
import type { Car } from "@/data/catalog";
import { BOX_H, BOX_W, GROUND, polygonPath, profileFor } from "@/lib/profile";

/**
 * The flat die-cast: the same outline the 3D miniature is extruded from,
 * drawn as SVG. Used on the garage cards and as the fallback wherever
 * WebGL is missing. `lights` switches the headlamps on (hover on cards);
 * `reflect` adds the wet-floor mirror image.
 */
export function CarSvg({
  car,
  lights = false,
  reflect = true,
  ghost = false,
  className = "",
  title,
}: {
  car: Car;
  lights?: boolean;
  reflect?: boolean;
  /** Outline only — the bay reserved for a car nobody has claimed. */
  ghost?: boolean;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const p = profileFor(car);
  if (ghost) return <GhostSvg car={car} className={className} title={title} />;
  const paintId = `p${uid}`;
  const glassId = `g${uid}`;
  const rimId = `r${uid}`;
  const fadeId = `f${uid}`;
  const glowId = `h${uid}`;
  const carId = `c${uid}`;
  const s = p.size;
  const spokes = [0, 72, 144, 216, 288];
  const viewH = reflect ? BOX_H + 34 : BOX_H;

  return (
    <svg viewBox={`0 0 ${BOX_W} ${viewH}`} className={className} role="img" aria-label={title ?? car.name} data-lights={lights ? "on" : "off"}>
      <defs>
        <linearGradient id={paintId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.28" stopColor={car.paint} stopOpacity="1" />
          <stop offset="0.72" stopColor={car.paint} stopOpacity="1" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a4b6e" />
          <stop offset="0.35" stopColor="#0c1120" />
          <stop offset="1" stopColor="#05070c" />
        </linearGradient>
        <radialGradient id={rimId} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#aeb4bf" />
          <stop offset="1" stopColor="#4a5060" />
        </radialGradient>
        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`m${uid}`}>
          <rect x="0" y={GROUND} width={BOX_W} height="34" fill={`url(#${fadeId})`} />
        </mask>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="100" cy={GROUND + 1.5} rx={92 * s} ry={3.2} fill="#000" opacity="0.55" />

      <g id={carId} transform={`translate(100 ${GROUND}) scale(${s}) translate(-100 -${GROUND})`}>
        {/* Wing sits behind the body */}
        {p.wing ? <path d={p.wing} fill={car.paint} stroke="#000" strokeOpacity="0.45" strokeWidth="0.5" /> : null}
        <path d={p.body} fill={car.paint} />
        <path d={p.body} fill={`url(#${paintId})`} style={{ mixBlendMode: "overlay" }} />
        <path d={p.body} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="0.7" />
        {p.glass.map((poly, i) => (
          <path key={i} d={polygonPath(poly)} fill={`url(#${glassId})`} stroke="#0a0d14" strokeWidth="0.5" />
        ))}
        {/* Sill / lower body shadow line */}
        <path d={p.body} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="0.6" />

        {p.wheels.map((w, i) => (
          <g key={i} transform={`translate(${w.x} ${w.y})`}>
            <circle r={w.r} fill="#0b0c0f" />
            <circle r={w.r - 0.6} fill="none" stroke="#1b1d22" strokeWidth="1" />
            <circle r={w.r * 0.66} fill={`url(#${rimId})`} />
            <circle r={w.r * 0.66} fill="none" stroke="#2a2f3a" strokeWidth="0.6" />
            {spokes.map((a) => (
              <rect key={a} x={-w.r * 0.09} y={-w.r * 0.62} width={w.r * 0.18} height={w.r * 0.48} rx={w.r * 0.06} fill="#3c424e" transform={`rotate(${a})`} />
            ))}
            <circle r={w.r * 0.16} fill="#dfe3ea" />
          </g>
        ))}

        {/* Lamps */}
        <g>
          <ellipse cx={p.head[0]} cy={p.head[1]} rx="3.2" ry="1.6" fill={lights ? "#fff7d6" : "#d9dde6"} opacity={lights ? 1 : 0.7} />
          {lights ? <ellipse cx={p.head[0] + 1} cy={p.head[1]} rx="9" ry="4" fill="#ffefb0" opacity="0.75" filter={`url(#${glowId})`} /> : null}
          <ellipse cx={p.tail[0]} cy={p.tail[1]} rx="2.2" ry="1.4" fill={lights ? "#ff3b3b" : "#7a1a1a"} />
          {lights ? <ellipse cx={p.tail[0] - 1} cy={p.tail[1]} rx="6" ry="3" fill="#ff5252" opacity="0.6" filter={`url(#${glowId})`} /> : null}
        </g>
      </g>

      {reflect ? (
        <g mask={`url(#m${uid})`} transform={`matrix(1 0 0 -1 0 ${GROUND * 2})`}>
          <use href={`#${carId}`} />
        </g>
      ) : null}
    </svg>
  );
}

/** The same outline as a dashed chalk drawing on the bay floor. */
function GhostSvg({ car, className, title }: { car: Car; className?: string; title?: string }) {
  const p = profileFor(car);
  const s = p.size;
  return (
    <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} className={className} role="img" aria-label={title ?? `${car.name} (unclaimed)`}>
      <g transform={`translate(100 ${GROUND}) scale(${s}) translate(-100 -${GROUND})`} fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="3 2.2" strokeLinejoin="round">
        {p.wing ? <path d={p.wing} /> : null}
        <path d={p.body} />
        {p.glass.map((poly, i) => (
          <path key={i} d={polygonPath(poly)} strokeDasharray="2 1.6" strokeWidth="0.8" opacity="0.7" />
        ))}
        {p.wheels.map((w, i) => (
          <g key={i}>
            <circle cx={w.x} cy={w.y} r={w.r} />
            <circle cx={w.x} cy={w.y} r={w.r * 0.45} strokeDasharray="1.5 1.5" strokeWidth="0.8" opacity="0.7" />
          </g>
        ))}
      </g>
      <line x1="8" y1={GROUND + 1} x2={BOX_W - 8} y2={GROUND + 1} stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 3" opacity="0.5" />
    </svg>
  );
}
