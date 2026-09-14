import { CARS, TIERS, pairOf, decadeOf } from "../src/data/catalog.ts";
const byTier: Record<string, number> = {};
const names = new Set<string>();
for (const c of CARS) {
  byTier[c.tier] = (byTier[c.tier] ?? 0) + 1;
  if (names.has(c.name)) throw new Error("duplicate name " + c.name);
  names.add(c.name);
  if (!/^[A-Z0-9]+$/.test(c.ticker)) throw new Error("bad ticker " + c.ticker);
}
console.log("cars", CARS.length, byTier, "tiers", TIERS.map((t) => t.id).join(","));
const pairs: Record<string, string[]> = {};
for (const c of CARS) (pairs[pairOf(c).symbol] ??= []).push(c.ticker);
for (const [k, v] of Object.entries(pairs)) if (k !== "ETH") console.log(k, v.join(" "));
console.log("ETH", pairs.ETH.length);
console.log("decades", [...new Set(CARS.map(decadeOf))].sort().join(" "));
console.log("null units", CARS.filter((c) => c.units === null).map((c) => c.ticker).join(" "));
