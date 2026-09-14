/** Number formatting for the spec sheets and the market figures. */

export function shortAddress(a: string, chars = 4): string {
  if (!a) return "";
  return `${a.slice(0, 2 + chars)}…${a.slice(-chars)}`;
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

/** Compact number: 1.2k · 3.4m · 1.0b. */
export function fmtCompact(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}b`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}m`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(abs < 10 ? 2 : 0);
}

/** A quote amount (ETH or a stock token) with sensible precision. */
export function fmtQuote(n: number, symbol: string): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs > 0 && abs < 0.001) {
    // A token on a fresh curve is worth nano-quote: keep three significant figures instead of rounding to zero.
    return `${n.toFixed(Math.min(18, Math.ceil(-Math.log10(abs)) + 1)).replace(/0+$/, "")} ${symbol.toLowerCase()}`;
  }
  const digits = abs === 0 ? 0 : abs < 1 ? 4 : abs < 100 ? 3 : 1;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${symbol.toLowerCase()}`;
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function timeAgo(unixSeconds: number, now = Date.now() / 1000): string {
  const d = Math.max(0, now - unixSeconds);
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

/** Wei/base units → number in whole units (float, for display only). */
export function toUnits(v: bigint | string, decimals = 18): number {
  const b = typeof v === "string" ? BigInt(v) : v;
  return Number(b) / 10 ** decimals;
}
