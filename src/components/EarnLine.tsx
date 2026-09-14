"use client";

import { creatorSharePct } from "@/lib/garage";
import { useGarage } from "@/lib/useGarage";

/** The creator's cut, read live off a Pons curve (0.7% until the first read lands). */
export function SharePct({ digits = 1 }: { digits?: number }) {
  const { state } = useGarage();
  return <>{creatorSharePct(state).toFixed(digits)}%</>;
}
