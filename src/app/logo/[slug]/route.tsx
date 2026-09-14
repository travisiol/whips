import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { CAR_BY_SLUG } from "@/data/catalog";
import { profileSvg } from "@/lib/profileSvg";
import { photoOf } from "@/data/photos";
import { existsSync } from "node:fs";

/**
 * GET /logo/<slug>.png — the token image: asphalt, the ring of light, the
 * real car (its Commons cutout; the generated profile when a car has no
 * photo), the ticker. This is the default logo a launch stores on chain
 * when no image is pinned, so every token ships with an identity.
 */
let fontData: ArrayBuffer | null = null;

async function displayFont(): Promise<ArrayBuffer> {
  if (!fontData) {
    const buf = await readFile(path.join(process.cwd(), "public", "fonts", "Archivo-BlackItalic.ttf"));
    fontData = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  return fontData;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const car = CAR_BY_SLUG.get(slug.replace(/\.png$/i, "").toLowerCase());
  if (!car) return new Response("no such car", { status: 404 });

  const cutout = photoOf(car) ? path.join(process.cwd(), "public", "cars", "png", `${car.slug}.png`) : null;
  const dataUri =
    cutout && existsSync(cutout)
      ? `data:image/png;base64,${(await readFile(cutout)).toString("base64")}`
      : `data:image/svg+xml;base64,${Buffer.from(profileSvg(car, { width: 480, height: 270, reflect: true })).toString("base64")}`;
  const font = await displayFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          background: "linear-gradient(180deg, #0a0a0c 0%, #0d0d12 60%, #0a0a0c 100%)",
          position: "relative",
          fontFamily: "Archivo",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 36,
            top: 205,
            width: 440,
            height: 84,
            borderRadius: 220,
            border: "4px solid #2a5bff",
            boxShadow: "0 0 60px rgba(42,91,255,0.55)",
            opacity: 0.9,
            display: "flex",
          }}
        />
        <div style={{ position: "absolute", top: 40, left: 26, width: 460, height: 230, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri} alt="" style={{ maxWidth: 460, maxHeight: 230, objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 40 }}>
          <div style={{ fontSize: 88, color: "#f2f3f5", letterSpacing: -4, lineHeight: 0.9, display: "flex" }}>${car.ticker.toLowerCase()}</div>
          <div style={{ fontSize: 22, color: "#7d828d", letterSpacing: 1, marginTop: 10, display: "flex", fontFamily: "Archivo" }}>
            {car.name.toLowerCase()} · {car.year}
          </div>
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
      fonts: [{ name: "Archivo", data: font, weight: 900, style: "italic" }],
      headers: { "cache-control": "public, max-age=86400, immutable" },
    },
  );
}
