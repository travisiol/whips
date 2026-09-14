import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { BodyStyle, Car } from "@/data/catalog";
import { dimsOf } from "@/data/dims";
import { GROUND, profileFor, type Pt } from "@/lib/profile";

/**
 * The lofted body. A car is built as a surface swept along its length:
 * at every station the cross-section is a rounded box whose width follows
 * the plan view (narrow nose, wide doors, tapered tail), whose height
 * follows the side profile (the same drawing the SVG cards use) and whose
 * greenhouse sits above the beltline with real tumblehome — flanks leaning
 * inward toward a narrower roof. The greenhouse faces are tagged as glass
 * and drawn with the dark glazing material in the same mesh.
 *
 * Sizes are the car's real length, width and height, so a Countach is two
 * metres wide and a metre tall and a 911 is narrow and tall. One unit is
 * one metre; the car stands on y = 0 with its nose toward +x.
 */
export type BodySpec = {
  length: number;
  width: number;
  height: number;
  style: BodyStyle;
  /** Wheel centre x (world) and radius. */
  wheels: { x: number; r: number }[];
  head: Pt;
  tail: Pt;
  /** Underside height. */
  floor: number;
  /** Top surface height at x. */
  top: (x: number) => number;
  /** Plan half-width at x. */
  half: (x: number) => number;
  cabin: { x0: number; x1: number; belt: number } | null;
};

const loader = new SVGLoader();
const STATIONS = 72;

/** Plan-view width, normalised, along the length (t = 0 tail → 1 nose). */
const PLANS: Record<BodyStyle, Pt[]> = {
  coupe: [[0, 0.8], [0.06, 0.92], [0.2, 0.99], [0.5, 1], [0.78, 0.97], [0.93, 0.86], [1, 0.72]],
  roadster: [[0, 0.8], [0.06, 0.92], [0.2, 0.99], [0.5, 1], [0.78, 0.97], [0.93, 0.86], [1, 0.72]],
  sedan: [[0, 0.84], [0.06, 0.95], [0.2, 1], [0.7, 1], [0.9, 0.95], [1, 0.8]],
  wagon: [[0, 0.9], [0.05, 0.98], [0.2, 1], [0.7, 1], [0.9, 0.96], [1, 0.8]],
  hatch: [[0, 0.88], [0.05, 0.97], [0.2, 1], [0.7, 1], [0.9, 0.95], [1, 0.78]],
  pickup: [[0, 0.96], [0.03, 1], [0.95, 1], [1, 0.9]],
};

/** How much narrower the greenhouse is than the body, at the belt and at the roof. */
const CABIN: Record<BodyStyle, [number, number]> = {
  coupe: [0.9, 0.66],
  roadster: [0.9, 0.7],
  sedan: [0.92, 0.72],
  wagon: [0.94, 0.8],
  hatch: [0.93, 0.76],
  pickup: [0.95, 0.82],
};

function lerpCurve(points: Pt[], t: number): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const u = (t - x0) / (x1 - x0);
      const s = u * u * (3 - 2 * u); // smoothstep between control points
      return y0 + (y1 - y0) * s;
    }
  }
  return points[points.length - 1][1];
}

/** Polygon points of the profile's body outline, in world units. */
function outlinePolygon(car: Car, sx: number, sy: number): Pt[] {
  const p = profileFor(car);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${p.body}"/></svg>`;
  const data = loader.parse(svg);
  const pts: Pt[] = [];
  for (const path of data.paths) {
    for (const shape of path.toShapes()) {
      for (const v of shape.getPoints(8)) pts.push([(v.x - 100) * sx, (GROUND - v.y) * sy]);
    }
  }
  return pts;
}

/** Highest point of the outline on the vertical line at x. */
function topOfPolygon(poly: Pt[], x: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) {
      if (a[0] === b[0]) continue;
      const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      if (best === null || y > best) best = y;
    }
  }
  return best;
}

export function bodySpec(car: Car): BodySpec {
  const [L, W, H] = dimsOf(car.slug);
  const p = profileFor(car);
  const sx = L / 192;
  const bodyTop = p.top; // highest body point in profile units (wings excluded)
  const sy = (H * 0.985) / (GROUND - bodyTop);
  const poly = outlinePolygon(car, sx, sy);

  // Sample the top line once; interpolate after.
  const samples: number[] = [];
  const n = 160;
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + (i / n) * L;
    const y = topOfPolygon(poly, x);
    samples.push(y ?? (i === 0 || i === n ? H * 0.42 : samples[i - 1] ?? H * 0.42));
  }
  const top = (x: number) => {
    const u = ((x + L / 2) / L) * n;
    const i = Math.max(0, Math.min(n - 1, Math.floor(u)));
    const f = u - i;
    return samples[i] * (1 - f) + samples[i + 1] * f;
  };

  const plan = PLANS[car.shape.body];
  const half = (x: number) => {
    const t = (x + L / 2) / L;
    // Round the very ends in plan so the caps read as bumpers, not slabs.
    const end = Math.min(t, 1 - t);
    const rounding = end < 0.035 ? Math.sqrt(Math.max(0, end / 0.035)) * 0.5 + 0.5 : 1;
    return (W / 2) * lerpCurve(plan, t) * rounding;
  };

  let cabin: BodySpec["cabin"] = null;
  if (p.glass.length) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let belt = Infinity;
    for (const poly of p.glass) {
      for (const [gx, gy] of poly) {
        const wx = (gx - 100) * sx;
        const wy = (GROUND - gy) * sy;
        x0 = Math.min(x0, wx);
        x1 = Math.max(x1, wx);
        belt = Math.min(belt, wy);
      }
    }
    cabin = { x0, x1, belt };
  }

  const r = L * (car.shape.body === "pickup" ? 0.078 : 0.074);
  return {
    length: L,
    width: W,
    height: H,
    style: car.shape.body,
    wheels: p.wheels.map((w) => ({ x: (w.x - 100) * sx, r })),
    head: [(p.head[0] - 100) * sx, (GROUND - p.head[1]) * sy],
    tail: [(p.tail[0] - 100) * sx, (GROUND - p.tail[1]) * sy],
    floor: r * 0.62,
    top,
    half,
    cabin,
  };
}

type Section = { pts: Pt[]; glass: boolean[]; under: boolean[] };

/** One cross-section, full loop, counter-clockwise seen from the nose: bottom centre → +z side → top → −z side. */
function section(spec: BodySpec, x: number): Section {
  const { width: W } = spec;
  const hw = spec.half(x);
  const yb = spec.floor;
  const yTop = Math.max(spec.top(x), yb + 0.08);
  const rs = Math.min(0.06 * W, (yTop - yb) * 0.3); // sill radius
  const rEdge = Math.min(0.11 * W, (yTop - yb) * 0.45); // hood / deck edge radius
  const [cabBelt, cabRoof] = CABIN[spec.style];
  const slope = Math.abs(spec.top(x + 0.05) - spec.top(x - 0.05)) / 0.1;

  const inCabin = spec.cabin !== null && x >= spec.cabin.x0 && x <= spec.cabin.x1 && yTop > spec.cabin.belt + 0.05;
  const belt = inCabin ? spec.cabin!.belt : yTop - rEdge;

  const right: Pt[] = [];
  const glass: boolean[] = [];
  const under: boolean[] = [];
  const push = (z: number, y: number, g = false, u = false) => {
    right.push([z, y]);
    glass.push(g);
    under.push(u);
  };

  // A. bottom centre — the underbody is matte black, like the real thing
  push(0, yb, false, true);
  // B. sill round (4)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    push(hw - rs + Math.sin(a) * rs, yb + rs - Math.cos(a) * rs, false, i < 2);
  }
  // C. flank up to the shoulder (4), with a soft bulge
  for (let i = 0; i < 4; i++) {
    const u = i / 4;
    const y = yb + rs + (belt - yb - rs) * u;
    push(hw + Math.sin(u * Math.PI) * 0.012 * W, y);
  }
  if (inCabin) {
    const rRoof = Math.min(0.09 * W, (yTop - belt) * 0.45);
    const zb = hw * cabBelt;
    const zr = hw * cabRoof;
    const steep = slope > 0.28;
    // D. shoulder step then the tumblehome (4) — glass
    push(hw, belt);
    push(zb, belt + 0.015, true);
    push(zb + (zr - zb) * 0.5, belt + 0.015 + (yTop - rRoof - belt - 0.015) * 0.5, true);
    push(zr, yTop - rRoof, true);
    // E. roof round (4) — glass where the top is steep (windscreen / backlight), paint on the flat roof
    for (let i = 1; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      push(zr - rRoof + Math.cos(a) * rRoof, yTop - rRoof + Math.sin(a) * rRoof, steep);
    }
    // F. top centre
    push(0, yTop, steep);
  } else {
    // D. hood edge round (4)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      push(hw - rEdge + Math.cos(a) * rEdge, yTop - rEdge + Math.sin(a) * rEdge);
    }
    // E. across the top toward the centre (4)
    const z0 = hw - rEdge;
    for (let i = 0; i < 4; i++) push(z0 * (1 - i / 4), yTop);
    // F. top centre
    push(0, yTop);
  }

  // Mirror: right half is bottom-centre … top-centre; the left half runs back down.
  const pts: Pt[] = [...right];
  const g: boolean[] = [...glass];
  const u: boolean[] = [...under];
  for (let i = right.length - 2; i >= 1; i--) {
    pts.push([-right[i][0], right[i][1]]);
    g.push(glass[i]);
    u.push(under[i]);
  }
  return { pts, glass: g, under: u };
}

/**
 * Builds the body geometry: three material groups, 0 = paint, 1 = glass, 2 = underbody.
 */
export function buildBodyGeometry(spec: BodySpec): THREE.BufferGeometry {
  const L = spec.length;
  const sections: Section[] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    // Pull the first and last stations slightly inward so the caps are clean.
    const x = -L / 2 + 0.012 + (L - 0.024) * t;
    sections.push(section(spec, x));
  }
  const P = sections[0].pts.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    const x = -L / 2 + 0.012 + (L - 0.024) * t;
    const s = sections[i];
    for (let j = 0; j < P; j++) {
      positions.push(x, s.pts[j][1], s.pts[j][0]);
      uvs.push(t * 4, j / P);
    }
  }
  const paint: number[] = [];
  const glass: number[] = [];
  const under: number[] = [];
  for (let i = 0; i < STATIONS; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    for (let j = 0; j < P; j++) {
      const j1 = (j + 1) % P;
      const v00 = i * P + j;
      const v01 = i * P + j1;
      const v10 = (i + 1) * P + j;
      const v11 = (i + 1) * P + j1;
      const isGlass = a.glass[j] && a.glass[j1] && b.glass[j] && b.glass[j1];
      const isUnder = a.under[j] && a.under[j1];
      const target = isGlass ? glass : isUnder ? under : paint;
      // Winding so the normal points outward (checked against the +z side).
      target.push(v00, v10, v11, v00, v11, v01);
    }
  }
  // Caps: tail (station 0) and nose (last), fans around a centre vertex.
  const capIndex = (i: number, centreY: number) => {
    const base = positions.length / 3;
    const x = -L / 2 + 0.012 + (L - 0.024) * (i / STATIONS);
    positions.push(x, centreY, 0);
    uvs.push(i === 0 ? 0 : 4, 0.5);
    return base;
  };
  const tailC = capIndex(0, (sections[0].pts[0][1] + sections[0].pts[P / 2 | 0][1]) / 2);
  for (let j = 0; j < P; j++) {
    const j1 = (j + 1) % P;
    paint.push(tailC, 0 * P + j, 0 * P + j1); // faces −x
  }
  const noseC = capIndex(STATIONS, (sections[STATIONS].pts[0][1] + sections[STATIONS].pts[P / 2 | 0][1]) / 2);
  for (let j = 0; j < P; j++) {
    const j1 = (j + 1) % P;
    paint.push(noseC, STATIONS * P + j1, STATIONS * P + j); // faces +x
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([...paint, ...glass, ...under]);
  geometry.addGroup(0, paint.length, 0);
  geometry.addGroup(paint.length, glass.length, 1);
  geometry.addGroup(paint.length + glass.length, under.length, 2);
  geometry.computeVertexNormals();
  return geometry;
}
