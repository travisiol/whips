/**
 * Side profiles. Every car becomes the same thing: a closed outline in a
 * 200 × 80 box (y down, ground at y = 76), a few glass polygons, two wheel
 * positions, two lamp anchors. The SVG cards draw it flat; the three.js
 * builder extrudes the very same outline into the die-cast miniature.
 *
 * Grails come with a hand-drawn top line (src/data/profiles.ts). Every
 * other car is a template — coupé, sedan, roadster, pickup, wagon, hatch —
 * bent by the catalog's `shape` parameters. Both go through the same
 * closing step, which draws the underbody and cuts the wheel arches.
 */
import type { BodyStyle, Car, Shape } from "../data/catalog.ts";
import { GRAIL_PROFILES, type HandProfile } from "../data/profiles.ts";

export type Pt = [number, number];
/** A point on a smooth top line; `true` marks a sharp corner. */
export type Node = [number, number, boolean?];

export type CarProfile = {
  /** Closed SVG path for the body, wheel arches cut out. */
  body: string;
  /** Closed SVG path for a rear wing, when the car has one. */
  wing?: string;
  /** Dark glazing, as closed polygons. */
  glass: Pt[][];
  /** Wheel centers and radius, rear first. */
  wheels: { x: number; y: number; r: number }[];
  head: Pt;
  tail: Pt;
  /** Highest point of the body (smallest y), for framing. */
  top: number;
  /** Scale against the 200-unit box. */
  size: number;
  /** Extruded width as a fraction of the length. */
  width: number;
};

export const BOX_W = 200;
export const BOX_H = 80;
export const GROUND = 76;
const XR = 4; // tail x
const XF = 196; // nose x

const DEFAULTS: Record<BodyStyle, Required<Omit<Shape, "body" | "bed" | "size">> & { bed: number; size: number; sill: number }> = {
  coupe: { roof: 30, cabin: [0.3, 0.64], nose: 52, tail: 42, rearDrop: 0.5, spoiler: 0, wheelbase: 0.6, wheel: 13, size: 1, width: 0.44, bed: 0, sill: 66 },
  sedan: { roof: 26, cabin: [0.26, 0.64], nose: 50, tail: 38, rearDrop: 0.2, spoiler: 0, wheelbase: 0.6, wheel: 13, size: 1.04, width: 0.43, bed: 0, sill: 66 },
  roadster: { roof: 36, cabin: [0.38, 0.62], nose: 52, tail: 44, rearDrop: 0.3, spoiler: 0, wheelbase: 0.58, wheel: 13, size: 0.9, width: 0.43, bed: 0, sill: 66 },
  pickup: { roof: 18, cabin: [0.42, 0.7], nose: 40, tail: 34, rearDrop: 0, spoiler: 0, wheelbase: 0.64, wheel: 14, size: 1.12, width: 0.46, bed: 36, sill: 62 },
  wagon: { roof: 22, cabin: [0.08, 0.64], nose: 48, tail: 28, rearDrop: 0.05, spoiler: 0, wheelbase: 0.62, wheel: 13, size: 1.06, width: 0.44, bed: 0, sill: 65 },
  hatch: { roof: 26, cabin: [0.16, 0.6], nose: 48, tail: 34, rearDrop: 0.35, spoiler: 0, wheelbase: 0.58, wheel: 12, size: 0.86, width: 0.42, bed: 0, sill: 66 },
};

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Catmull-Rom through the nodes, emitted as cubic Béziers; sharp nodes break the tangent. */
export function smoothPath(nodes: Node[], close = false): string {
  if (nodes.length < 2) return "";
  const pts = nodes;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const sharp1 = p1[2] === true;
    const sharp2 = p2[2] === true;
    // Tangents: a sharp end uses the chord itself, so the corner stays crisp.
    const t1: Pt = sharp1 ? [(p2[0] - p1[0]) / 3, (p2[1] - p1[1]) / 3] : [(p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6];
    const t2: Pt = sharp2 ? [(p2[0] - p1[0]) / 3, (p2[1] - p1[1]) / 3] : [(p3[0] - p1[0]) / 6, (p3[1] - p1[1]) / 6];
    d += ` C ${f(p1[0] + t1[0])} ${f(p1[1] + t1[1])} ${f(p2[0] - t2[0])} ${f(p2[1] - t2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return close ? d + " Z" : d;
}

/**
 * Draws the underbody from the nose down to the sill, back along the sill
 * with the two arches cut out, and up the tail to close.
 */
function closeUnderbody(top: string, wheels: { x: number; y: number; r: number }[], sill: number, xf: number, xr: number): string {
  const [rear, front] = wheels;
  const arch = (w: { x: number; y: number; r: number }) => {
    const ra = w.r + 2.6;
    const dy = sill - w.y; // sill sits below the axle
    const half = Math.sqrt(Math.max(0, ra * ra - dy * dy));
    // From the front edge of the arch, over the top, to the rear edge.
    return `L ${f(w.x + half)} ${f(sill)} A ${f(ra)} ${f(ra)} 0 1 0 ${f(w.x - half)} ${f(sill)}`;
  };
  return `${top} L ${f(xf)} ${f(sill)} ${arch(front)} ${arch(rear)} L ${f(xr)} ${f(sill)} Z`;
}

function wheelsFor(wheelbase: number, r: number, xf = XF, frontOverhang = 14): { x: number; y: number; r: number }[] {
  const y = GROUND - r;
  const front = xf - r - frontOverhang;
  const rear = front - wheelbase * (XF - XR);
  return [
    { x: rear, y, r },
    { x: front, y, r },
  ];
}

function wingPath(xr: number, tailY: number, kind: 1 | 2): string {
  if (kind === 1) {
    // A lip: small wedge on the deck edge.
    return `M ${f(xr + 1)} ${f(tailY)} L ${f(xr + 12)} ${f(tailY + 0.5)} L ${f(xr + 12)} ${f(tailY - 2)} L ${f(xr + 1)} ${f(tailY - 3.5)} Z`;
  }
  // A wing on two struts.
  const blade = tailY - 9;
  return `M ${f(xr + 3)} ${f(tailY - 1)} L ${f(xr + 6)} ${f(tailY - 1)} L ${f(xr + 7)} ${f(blade + 3)} L ${f(xr + 1)} ${f(blade + 2.4)} L ${f(xr + 1.5)} ${f(blade)} L ${f(xr + 22)} ${f(blade - 1.6)} L ${f(xr + 22)} ${f(blade + 0.6)} L ${f(xr + 12)} ${f(blade + 3.2)} L ${f(xr + 13)} ${f(tailY - 1)} L ${f(xr + 16)} ${f(tailY - 1)} L ${f(xr + 16)} ${f(tailY + 1)} L ${f(xr + 3)} ${f(tailY + 1)} Z`;
}

/** The parametric bodies. Everything is in box units; `size` scales later. */
function templateProfile(shape: Shape): CarProfile {
  const d = DEFAULTS[shape.body];
  const roof = shape.roof ?? d.roof;
  const [c0, c1] = shape.cabin ?? d.cabin;
  const nose = shape.nose ?? d.nose;
  const tail = shape.tail ?? d.tail;
  const rearDrop = shape.rearDrop ?? d.rearDrop;
  const spoiler = shape.spoiler ?? d.spoiler;
  const wheelbase = shape.wheelbase ?? d.wheelbase;
  const r = shape.wheel ?? d.wheel;
  const size = shape.size ?? d.size;
  const width = shape.width ?? d.width;
  const bed = shape.bed ?? d.bed;
  const sill = d.sill;
  const xr = XR;
  const xf = XF;
  const L = xf - xr;
  const xC = xr + c0 * L; // cabin rear (C pillar base)
  const xA = xr + c1 * L; // cabin front (A pillar base / cowl)
  const hood = nose - 6;
  const wheels = wheelsFor(wheelbase, r);
  const glass: Pt[][] = [];
  let top: string;
  let wing: string | undefined;
  let highest = roof;

  if (shape.body === "pickup") {
    const cabRear = xC;
    const nodes: Node[] = [
      [xr, sill, true],
      [xr, bed, true],
      [cabRear - 1, bed, true],
      [cabRear + 1, roof + 3, true],
      [cabRear + 8, roof],
      [xA - 6, roof + 0.6],
      [xA + 7, hood + 0.5],
      [xf - 10, hood - 0.5],
      [xf - 2, nose - 1],
      [xf, nose + 2, true],
    ];
    top = smoothPath(nodes);
    const belt = roof + (hood - roof) * 0.5;
    glass.push([
      [cabRear + 3.5, belt],
      [cabRear + 5, roof + 3.5],
      [xA - 6, roof + 3.8],
      [xA + 3, belt],
    ]);
    highest = roof;
  } else if (shape.body === "roadster") {
    const deck = tail - 3;
    const screenTop = roof;
    const nodes: Node[] = [
      [xr, sill, true],
      [xr + 0.5, tail, true],
      [xr + 8, deck + 0.5],
      [xC - 6, deck - 0.5],
      [xC + 2, deck + 0.8], // cockpit lip
      [xA - 4, hood + 2],
      [xA + 8, hood],
      [xf - 12, hood - 0.6],
      [xf - 3, nose - 1.2],
      [xf, nose + 2, true],
    ];
    top = smoothPath(nodes);
    // Windscreen: a raked fin.
    glass.push([
      [xA - 10, hood + 1.5],
      [xA - 15, screenTop],
      [xA - 11, screenTop - 0.5],
      [xA - 4, hood + 1],
    ]);
    // Cockpit opening reads as dark too.
    glass.push([
      [xC + 4, deck + 0.4],
      [xC + 5, deck - 1.2],
      [xA - 10, deck - 1.6],
      [xA - 8, deck + 0.6],
    ]);
    if (spoiler === 1) wing = wingPath(xr, tail, 1);
    highest = screenTop;
  } else {
    // coupé · sedan · wagon · hatch — one algorithm, different numbers.
    const notch = 1 - rearDrop;
    // Where the rear glass meets the deck: near the C pillar for a notchback, near the tail for a fastback.
    const kinkX = xr + 3 + (xC - xr - 3) * notch;
    const kinkY = tail - (tail - roof) * rearDrop * 0.12;
    const roofRear = [xC + (xA - xC) * (shape.body === "wagon" || shape.body === "hatch" ? 0.06 : 0.16), roof + 1.2] as const;
    const nodes: Node[] = [[xr, sill, true], [xr + 0.5, tail + 1, true]];
    if (notch > 0.15) nodes.push([xr + 6, tail - 0.5]);
    nodes.push([kinkX, kinkY, notch > 0.6]);
    nodes.push([roofRear[0], roofRear[1]]);
    nodes.push([xC + (xA - xC) * 0.5, roof]);
    nodes.push([xA - (xA - xC) * 0.12, roof + 1.4]);
    nodes.push([xA + 4, hood + 1]);
    nodes.push([(xA + xf) / 2 + 4, hood - 0.8]);
    nodes.push([xf - 5, nose - 1.6]);
    nodes.push([xf, nose + 2, true]);
    top = smoothPath(nodes);

    const belt = roof + (hood - roof) * 0.62;
    const gRear: Pt = [xC + 3 + rearDrop * 5, belt];
    const gTop1: Pt = [xC + (xA - xC) * 0.2, roof + 4];
    const gTop2: Pt = [xA - (xA - xC) * 0.1, roof + 4.6];
    const gFront: Pt = [xA + 2, belt];
    if (shape.body === "sedan" || shape.body === "wagon") {
      const mid = xC + (xA - xC) * 0.52;
      glass.push([gRear, gTop1, [mid - 1, roof + 4.2], [mid - 2, belt]]);
      glass.push([[mid + 1, belt], [mid, roof + 4.2], gTop2, gFront]);
    } else {
      glass.push([gRear, gTop1, gTop2, gFront]);
    }
    if (shape.body === "wagon" || shape.body === "hatch") {
      // Rear quarter glass reaching back toward the tailgate.
      glass.push([
        [xr + 5, belt + 1],
        [xr + 7, roof + 5],
        [xC + 1, roof + 4.4],
        [xC + 1, belt + 0.6],
      ]);
    }
    if (spoiler) wing = wingPath(xr, tail, spoiler);
    highest = roof;
  }

  return {
    body: closeUnderbody(top, wheels, sill, xf, xr),
    wing,
    glass,
    wheels,
    head: [xf - 3.5, nose + 3],
    tail: [xr + 3, tail + 4],
    top: wing && spoiler === 2 ? Math.min(highest, tail - 10) : highest,
    size,
    width,
  };
}

function handProfile(h: HandProfile, shape: Shape): CarProfile {
  const r = h.wheel ?? 13;
  const wheels = [
    { x: h.axles[0], y: GROUND - r, r },
    { x: h.axles[1], y: GROUND - r, r },
  ];
  const sill = h.sill ?? 66;
  return {
    body: closeUnderbody(h.top, wheels, sill, XF, XR),
    wing: h.wing,
    glass: h.glass,
    wheels,
    head: h.head,
    tail: h.tail,
    top: h.roof,
    size: h.size ?? shape.size ?? 1,
    width: shape.width ?? 0.44,
  };
}

const cache = new Map<number, CarProfile>();

/** The profile for a car — hand-drawn when it has one, generated otherwise. */
export function profileFor(car: Car): CarProfile {
  const hit = cache.get(car.id);
  if (hit) return hit;
  const hand = GRAIL_PROFILES[car.slug];
  const p = hand ? handProfile(hand, car.shape) : templateProfile(car.shape);
  cache.set(car.id, p);
  return p;
}

/** Polygon → closed path. */
export function polygonPath(poly: Pt[]): string {
  return poly.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${f(x)} ${f(y)}`).join(" ") + " Z";
}
