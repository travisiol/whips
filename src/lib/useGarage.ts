"use client";

import { useQuery } from "@tanstack/react-query";
import type { CarDetail, Claimed, GarageState } from "@/lib/garage";

/**
 * The garage state, refreshed every 15 seconds while the tab is visible.
 * Pages that read it on the server pass that read as `initial`, so the
 * first paint already shows which bays are taken.
 */
export function useGarage(initial?: GarageState) {
  const query = useQuery<GarageState>({
    queryKey: ["garage"],
    initialData: initial,
    initialDataUpdatedAt: initial ? initial.readAt * 1000 : undefined,
    queryFn: async () => {
      const res = await fetch("/api/garage", { cache: "no-store" });
      if (!res.ok) throw new Error(`garage ${res.status}`);
      return (await res.json()) as GarageState;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });
  const claims = new Map<number, Claimed>();
  for (const c of query.data?.claims ?? []) claims.set(c.itemId, c);
  return { ...query, state: query.data, claims };
}

/** One car's trades and holders, refreshed every 15 seconds while open. */
export function useCarDetail(itemId: number | null, enabled = true) {
  return useQuery<CarDetail>({
    queryKey: ["car", itemId],
    enabled: itemId !== null && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/car/${itemId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`car ${res.status}`);
      return (await res.json()) as CarDetail;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });
}
