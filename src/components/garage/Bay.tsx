"use client";

import { CarPhoto } from "@/components/CarPhoto";
import { CarThumb } from "@/components/CarThumb";
import { photoOf } from "@/data/photos";
import { pairOf, type Car } from "@/data/catalog";
import { fmtCompact, fmtInt, fmtPct, shortAddress } from "@/lib/format";
import type { Claimed } from "@/lib/garage";

/**
 * One parking bay. Open = the die-cast waiting in the dark with one
 * promise on the card: launch it and you earn a cut of every trade.
 * Taken = parked under its ring of light, headlamps on hover, with the
 * live cap and progress to graduation.
 */
export function Bay({ car, claim, onSelect, pickMode = false, creatorSharePct }: { car: Car; claim: Claimed | null; onSelect: (car: Car) => void; pickMode?: boolean; creatorSharePct: number }) {
  const pair = pairOf(car);
  const taken = claim !== null;
  const units = car.units === null ? "n/a" : `${car.approx ? "~" : ""}${fmtInt(car.units)}`;
  const q = pair.symbol.toLowerCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(car)}
      className={`group relative flex w-full flex-col text-left ${taken ? "card card-hover" : "bay"} ${!taken && pickMode ? "!border-bayside/60" : ""} overflow-hidden p-4 transition-colors`}
      aria-label={`${car.name}, ${taken ? "taken" : "open"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="bay-number">{String(car.id).padStart(3, "0")}</span>
        <span className={`mono rounded-full border px-2 py-0.5 text-[10px] ${pair.symbol === "ETH" ? "border-line-2 text-ink-3" : "border-bayside/50 text-bayside-2"}`}>
          earns {q}
        </span>
      </div>

      <div className="-mt-6">
        {photoOf(car) ? (
          <CarPhoto car={car} lit={taken} className="[&_.car-photo-img]:group-hover:scale-[1.03]" />
        ) : (
          <CarThumb car={car} lit={taken} className={taken ? "" : "opacity-80 group-hover:opacity-100"} />
        )}
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="mono text-[15px] text-ink">${car.ticker.toLowerCase()}</span>
        <span className="mono text-[11px] text-ink-3">{car.year}</span>
      </div>
      <div className="truncate text-[13px] text-ink-2">{car.name.toLowerCase()}</div>

      <div className="spec mt-3 w-full">
        <div>
          <div className="k">0–100</div>
          <div className="v">
            {car.accel}
            <small>s</small>
          </div>
        </div>
        <div>
          <div className="k">top</div>
          <div className="v">
            {car.top}
            <small>km/h</small>
          </div>
        </div>
        <div>
          <div className="k">made</div>
          <div className="v">{units}</div>
        </div>
      </div>

      {taken && claim ? (
        <div className="mt-3 w-full">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-ink-3">cap</span>
            <span className="mono text-ink">
              {fmtCompact(claim.market.marketCap, 2)} {claim.pair.toLowerCase()}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="text-ink-3">{claim.market.graduated ? "graduated" : "to graduation"}</span>
            <span className="mono text-ink-2">{claim.market.graduated ? "in pool" : fmtPct(claim.market.progressPct, 0)}</span>
          </div>
          <div className="bar mt-1.5">
            <i style={{ width: `${Math.max(2, claim.market.graduated ? 100 : claim.market.progressPct)}%` }} />
          </div>
          <div className="mono mt-2 truncate text-[11px] text-ink-3">
            taken · ${car.ticker.toLowerCase()} · {shortAddress(claim.launcher)}
          </div>
        </div>
      ) : (
        <div className="mt-3 w-full rounded-xl border border-bayside/25 bg-bayside/[0.07] px-3 py-2.5">
          <div className="text-[12px] leading-snug text-ink">
            launch it, earn <b className="text-bayside-2">{creatorSharePct.toFixed(1)}%</b> of every trade in {q}.
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="mono text-[10px] text-ink-3">open · nobody has claimed it</span>
            <span className="btn btn-primary btn-sm !h-7 !px-3 !text-[11px]">claim</span>
          </div>
        </div>
      )}
    </button>
  );
}
