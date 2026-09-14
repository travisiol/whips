import { CAR_BY_ID } from "@/data/catalog";
import { readCar } from "@/lib/garage";

/** GET /api/car/<itemId> → the claim, recent trades and holders, from logs (15 s cache). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!CAR_BY_ID.has(itemId)) return Response.json({ ok: false, error: "no such car" }, { status: 404 });
  const detail = await readCar(itemId);
  return Response.json(detail, { headers: { "cache-control": "no-store" } });
}
