/**
 * Token images.
 *
 *   GET  /api/upload → { enabled }          whether pinning is configured
 *   POST /api/upload → { ok, uri }          multipart `file` → ipfs://<cid>
 *
 * Pinning needs a key, so it is the operator's choice: PINATA_JWT pins
 * through Pinata. Pons' own upload endpoint is gated by the Origin header
 * and is not impersonated here. Without a key the launch form offers the
 * site's own /logo/<car>.png or any https URL — nothing here is required
 * to launch.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function pinataJwt() {
  return process.env.PINATA_JWT?.trim() || null;
}

export async function GET() {
  return Response.json({ enabled: pinataJwt() !== null, via: pinataJwt() ? "pinata" : null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const jwt = pinataJwt();
  if (!jwt) return Response.json({ ok: false, error: "image uploads are not configured here. use the built-in logo or paste an https url." }, { status: 501 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "expected a multipart form with a `file` field." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "no file." }, { status: 400 });
  if (!TYPES.has(file.type)) return Response.json({ ok: false, error: "use a png, jpeg, webp or gif." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return Response.json({ ok: false, error: "images must be under 5 mb." }, { status: 400 });

  try {
    const body = new FormData();
    body.append("file", file, file.name || "token-image");
    body.append("pinataMetadata", JSON.stringify({ name: `whips-${Date.now()}` }));
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { authorization: `Bearer ${jwt}` }, body });
    const json = (await res.json().catch(() => ({}))) as { IpfsHash?: string };
    if (!res.ok || !json.IpfsHash) return Response.json({ ok: false, error: `pinata refused the upload (${res.status}).` }, { status: 502 });
    return Response.json({ ok: true, uri: `ipfs://${json.IpfsHash}` });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "upload upstream unreachable" }, { status: 502 });
  }
}
