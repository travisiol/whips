"use client";

import Link from "next/link";
import { CarPhoto } from "@/components/CarPhoto";
import { TimeAgo } from "@/components/TimeAgo";
import { CAR_BY_ID } from "@/data/catalog";
import { fmtCompact, fmtPct, shortAddress } from "@/lib/format";
import type { GarageState } from "@/lib/garage";
import { useGarage } from "@/lib/useGarage";

/**
 * What everyone sees the moment someone launches: the newest claims, read
 * from the chain every 15 seconds, on the home page. Empty until the first
 * launch — and it says so, rather than pretending.
 */
export function LatestLaunches({ initial }: { initial?: GarageState }) {
  const { state } = useGarage(initial);
  const latest = [...(state?.claims ?? [])].sort((a, b) => b.launchedAt - a.launchedAt || b.itemId - a.itemId).slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-label="latest launches">
      <div className="flex items-end justify-between gap-3">
        <h2 className="display text-[32px] text-ink sm:text-[40px]">latest launches</h2>
        <span className="mono text-[11px] text-ink-4">
          {state ? (
            <>
              {state.claims.length} of 120 claimed · <TimeAgo ts={state.readAt} prefix="read " fallback="live" />
            </>
          ) : (
            "reading the chain…"
          )}
        </span>
      </div>
      {latest.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-ink-2">nothing launched yet. the first bay is waiting — and its creator fees with it.</p>
          <Link href="/garage?pick=1" className="btn btn-primary btn-sm">
            be first
          </Link>
        </div>
      ) : (
        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-2">
          {latest.map((c) => {
            const car = CAR_BY_ID.get(c.itemId);
            if (!car) return null;
            return (
              <Link key={c.itemId} href={`/garage?car=${car.slug}`} className="card card-hover group w-[230px] shrink-0 p-3">
                <CarPhoto car={car} lit className="[&_.car-photo-img]:group-hover:scale-[1.03]" />
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="mono text-[13px] text-ink">${car.ticker.toLowerCase()}</span>
                  <span className="mono text-[11px] text-ink-3">{c.launchedAt ? <TimeAgo ts={c.launchedAt} /> : "just now"}</span>
                </div>
                <div className="mono mt-1 flex justify-between text-[11px]">
                  <span className="text-ink-3">cap {fmtCompact(c.market.marketCap, 2)} {c.pair.toLowerCase()}</span>
                  <span className="text-ink-3">{c.market.graduated ? "graduated" : `${fmtPct(c.market.progressPct, 0)} to grad`}</span>
                </div>
                <div className="mono mt-1 truncate text-[11px] text-ink-4">taken · {shortAddress(c.launcher)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
