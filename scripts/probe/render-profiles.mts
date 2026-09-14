import { writeFileSync } from "node:fs";
import { CARS } from "../../src/data/catalog.ts";
import { profileFor, polygonPath, GROUND } from "../../src/lib/profile.ts";
let html = `<!doctype html><meta charset="utf-8"><style>body{background:#0a0a0c;color:#ccc;font:12px system-ui;margin:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}figure{margin:0;background:#101015;border-radius:8px;padding:6px}figcaption{padding:4px 2px;color:#8a8f9a}svg{width:100%;display:block}</style>`;
for (const car of CARS) {
  const p = profileFor(car);
  const s = p.size;
  html += `<figure><svg viewBox="0 0 200 80"><line x1="0" y1="${GROUND}" x2="200" y2="${GROUND}" stroke="#333"/><g transform="translate(100 ${GROUND}) scale(${s}) translate(-100 -${GROUND})">${p.wing ? `<path d="${p.wing}" fill="${car.paint}" stroke="#000" stroke-width="0.5"/>` : ""}<path d="${p.body}" fill="${car.paint}" stroke="#fff" stroke-opacity="0.3" stroke-width="0.6"/>${p.glass.map((g) => `<path d="${polygonPath(g)}" fill="#0c1120"/>`).join("")}${p.wheels.map((w) => `<circle cx="${w.x}" cy="${w.y}" r="${w.r}" fill="#111"/><circle cx="${w.x}" cy="${w.y}" r="${w.r * 0.66}" fill="#aab"/>`).join("")}<circle cx="${p.head[0]}" cy="${p.head[1]}" r="2" fill="#ffe"/><circle cx="${p.tail[0]}" cy="${p.tail[1]}" r="1.5" fill="#f33"/></g></svg><figcaption>${car.id} · ${car.name} · ${car.shape.body}${(car as any).slug in {} ? "" : ""}</figcaption></figure>`;
}
writeFileSync("public/_profiles.html", html);
console.log("wrote public/_profiles.html", CARS.length);
