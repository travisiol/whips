import { readGarage } from "@/lib/garage";

/** GET /api/garage → every claim with its live market, read from the chain (15 s cache). */
export async function GET() {
  const state = await readGarage();
  return Response.json(state, { headers: { "cache-control": "no-store" } });
}
