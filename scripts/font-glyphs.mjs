// Converts the embedded Archivo Black Italic TTF (public/fonts, OFL) into the
// typeface.json shape three.js' Font/TextGeometry consume, keeping only the
// glyphs the 3D wordmark needs. Run: npm run font:glyphs
import { readFileSync, writeFileSync } from "node:fs";
import opentype from "opentype.js";

const SRC = new URL("../public/fonts/Archivo-BlackItalic.ttf", import.meta.url);
const OUT = new URL("../src/lib/three/wordmark-glyphs.json", import.meta.url);
const CHARS = "whips";

const font = opentype.parse(readFileSync(SRC).buffer);
const glyphs = {};
for (const ch of CHARS) {
  const glyph = font.charToGlyph(ch);
  const path = glyph.getPath(0, 0, font.unitsPerEm);
  const out = [];
  for (const c of path.commands) {
    // opentype's y grows upward here (getPath with fontSize = unitsPerEm keeps
    // font units but flips y for canvas), so undo the flip.
    switch (c.type) {
      case "M": out.push("m", r(c.x), r(-c.y)); break;
      case "L": out.push("l", r(c.x), r(-c.y)); break;
      case "Q": out.push("q", r(c.x), r(-c.y), r(c.x1), r(-c.y1)); break;
      case "C": out.push("b", r(c.x), r(-c.y), r(c.x1), r(-c.y1), r(c.x2), r(-c.y2)); break;
      case "Z": out.push("z"); break;
    }
  }
  const bb = glyph.getBoundingBox();
  glyphs[ch] = { ha: glyph.advanceWidth, x_min: bb.x1, x_max: bb.x2, o: out.join(" ") };
}
const json = {
  glyphs,
  familyName: "Archivo Black Italic",
  ascender: font.ascender,
  descender: font.descender,
  underlinePosition: font.tables.post.underlinePosition,
  underlineThickness: font.tables.post.underlineThickness,
  boundingBox: { yMin: font.tables.head.yMin, xMin: font.tables.head.xMin, yMax: font.tables.head.yMax, xMax: font.tables.head.xMax },
  resolution: font.unitsPerEm,
  original_font_information: { format: 0, copyright: "Archivo — Omnibus-Type, SIL Open Font License 1.1 (public/fonts/OFL.txt)" },
  cssFontWeight: "900",
  cssFontStyle: "italic",
};
writeFileSync(OUT, JSON.stringify(json));
console.log("wrote", OUT.pathname, "glyphs", Object.keys(glyphs).join(""), "unitsPerEm", font.unitsPerEm);
function r(n) { return Math.round(n * 10) / 10; }
