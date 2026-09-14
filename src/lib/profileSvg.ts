import type { Car } from "@/data/catalog";
import { BOX_W, GROUND, polygonPath, profileFor } from "@/lib/profile";

/**
 * The flat profile as a standalone SVG string — the same drawing as
 * <CarSvg>, for places that cannot render React: the token logo route and
 * open-graph images.
 */
export function profileSvg(car: Car, opts: { width?: number; height?: number; reflect?: boolean; background?: string | null } = {}): string {
  const p = profileFor(car);
  const s = p.size;
  const w = opts.width ?? 400;
  const h = opts.height ?? 200;
  const reflect = opts.reflect ?? true;
  const bg = opts.background === undefined ? null : opts.background;
  const viewH = reflect ? 112 : 80;
  const spokes = [0, 72, 144, 216, 288];
  const wheels = p.wheels
    .map(
      (wh) => `<g transform="translate(${wh.x} ${wh.y})"><circle r="${wh.r}" fill="#0b0c0f"/><circle r="${wh.r * 0.66}" fill="url(#rim)"/>${spokes
        .map((a) => `<rect x="${-wh.r * 0.09}" y="${-wh.r * 0.62}" width="${wh.r * 0.18}" height="${wh.r * 0.48}" rx="${wh.r * 0.06}" fill="#3c424e" transform="rotate(${a})"/>`)
        .join("")}<circle r="${wh.r * 0.16}" fill="#dfe3ea"/></g>`,
    )
    .join("");
  const glass = p.glass.map((g) => `<path d="${polygonPath(g)}" fill="url(#glass)" stroke="#0a0d14" stroke-width="0.5"/>`).join("");
  const car3 = `<g id="car" transform="translate(100 ${GROUND}) scale(${s}) translate(-100 -${GROUND})">${p.wing ? `<path d="${p.wing}" fill="${car.paint}" stroke="#000" stroke-opacity="0.45" stroke-width="0.5"/>` : ""}<path d="${p.body}" fill="${car.paint}"/><path d="${p.body}" fill="url(#paint)"/><path d="${p.body}" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="0.7"/>${glass}${wheels}<ellipse cx="${p.head[0]}" cy="${p.head[1]}" rx="3.2" ry="1.6" fill="#fff7d6"/><ellipse cx="${p.tail[0]}" cy="${p.tail[1]}" rx="2.2" ry="1.4" fill="#ff3b3b"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${BOX_W} ${viewH}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.3" stop-color="#fff" stop-opacity="0"/><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></linearGradient><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4b6e"/><stop offset="0.35" stop-color="#0c1120"/><stop offset="1" stop-color="#05070c"/></linearGradient><radialGradient id="rim" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#aeb4bf"/><stop offset="1" stop-color="#4a5060"/></radialGradient><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="m"><rect x="0" y="${GROUND}" width="${BOX_W}" height="34" fill="url(#fade)"/></mask></defs>${bg ? `<rect width="${BOX_W}" height="${viewH}" fill="${bg}"/>` : ""}<ellipse cx="100" cy="${GROUND + 1.5}" rx="${92 * s}" ry="3.2" fill="#000" opacity="0.55"/>${car3}${reflect ? `<g mask="url(#m)" transform="matrix(1 0 0 -1 0 ${GROUND * 2})"><use xlink:href="#car"/></g>` : ""}</svg>`;
}
