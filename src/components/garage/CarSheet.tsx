"use client";

import { useEffect, useState } from "react";
import { PhotoStage } from "@/components/PhotoStage";
import { ClaimedView } from "@/components/garage/ClaimedView";
import { LaunchForm, type LaunchResult } from "@/components/garage/LaunchForm";
import { pairOf, type Car } from "@/data/catalog";
import { fmtInt, shortAddress } from "@/lib/format";
import type { Claimed } from "@/lib/garage";
import { explorer } from "@/lib/chain";
import { photoCredit, photoOf } from "@/data/photos";

/**
 * The car's sheet, sliding in from the right: the die-cast on its plate,
 * the three-column spec sheet, the pair line, then either the launch flow
 * (bay open) or the live market with trading, holders and creator fees
 * (bay taken). When a launch confirms, the car drives out of the showroom
 * to the right while the token card drives in from the left.
 */
export function CarSheet(props: { car: Car | null; claim: Claimed | null; configured: boolean; ponsLaunchFeeWei: string; share: number; onClose: () => void }) {
  const { car, onClose } = props;
  const open = car !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!car) return null;
  // Keyed by car so the launch celebration state resets with the car.
  return <Sheet key={car.id} {...props} car={car} />;
}

function Sheet({ car, claim, configured, ponsLaunchFeeWei, share, onClose }: { car: Car; claim: Claimed | null; configured: boolean; ponsLaunchFeeWei: string; share: number; onClose: () => void }) {
  const [launched, setLaunched] = useState<LaunchResult | null>(null);
  const [exited, setExited] = useState(false);
  const pair = pairOf(car);
  const taken = claim !== null || launched !== null;
  const units = car.units === null ? "not disclosed" : `${car.approx ? "~" : ""}${fmtInt(car.units)}`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${car.name} sheet`}>
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-label="close" onClick={onClose} />
      <aside className="drive-in absolute inset-y-0 right-0 flex w-full flex-col bg-asphalt sm:w-[560px] lg:w-[680px] sm:border-l sm:border-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="mono text-[12px] text-ink-3">
            bay {String(car.id).padStart(3, "0")} · {car.tier} · {pair.symbol.toLowerCase()} pair
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            close
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto">
          {/* Stage + token card crossover */}
          <div className="relative h-[280px] overflow-hidden border-b border-line sm:h-[320px]">
            <PhotoStage car={car} exit={launched !== null} onExited={() => setExited(true)} className="h-full w-full" />
            {launched && exited ? (
              <div className="drive-in absolute inset-x-6 bottom-6 card card-accent p-5">
                <div className="label">launched · ${car.ticker.toLowerCase()}</div>
                <div className="display mt-2 text-[28px] text-ink">{car.name.toLowerCase()} is on the curve</div>
                <div className="mono mt-3 grid grid-cols-1 gap-1 text-[12px] text-ink-2 sm:grid-cols-2">
                  <a className="truncate hover:text-ink" href={explorer.token(launched.token)} target="_blank" rel="noreferrer">
                    token · {shortAddress(launched.token, 6)} ↗
                  </a>
                  <a className="truncate hover:text-ink" href={explorer.address(launched.curve)} target="_blank" rel="noreferrer">
                    curve · {shortAddress(launched.curve, 6)} ↗
                  </a>
                  <a className="truncate hover:text-ink sm:col-span-2" href={explorer.tx(launched.txHash)} target="_blank" rel="noreferrer">
                    tx · {shortAddress(launched.txHash, 8)} ↗
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-5 py-5">
            {photoOf(car) ? (
              <a href={photoOf(car)!.page} target="_blank" rel="noreferrer" className="mono -mt-2 mb-3 block truncate text-[10px] text-ink-4 hover:text-ink-3">
                {photoCredit(photoOf(car)!)} ↗
              </a>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-[34px] leading-none text-ink">{car.name.toLowerCase()}</h2>
              <span className="mono text-[13px] text-ink-3">{car.year}</span>
            </div>
            <div className="mono mt-1 text-[14px] text-bayside-2">${car.ticker.toLowerCase()}</div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{car.blurb}</p>

            <div className="spec mt-4">
              <div>
                <div className="k">0–100 km/h</div>
                <div className="v">
                  {car.approx ? "~" : ""}
                  {car.accel}
                  <small>s</small>
                </div>
              </div>
              <div>
                <div className="k">top speed</div>
                <div className="v">
                  {car.approx ? "~" : ""}
                  {car.top}
                  <small>km/h</small>
                </div>
              </div>
              <div>
                <div className="k">units made</div>
                <div className={`v ${car.units === null ? "!text-[12px] !text-ink-3" : ""}`}>{units}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-floor p-4 text-[13px] leading-relaxed text-ink-2">
              {pair.symbol === "ETH" ? (
                <>
                  <b className="text-ink">paired with eth.</b> {car.maker.toLowerCase()} isn&apos;t a pairable stock on pons, so this curve is quoted in eth and its creator fees arrive in eth.
                </>
              ) : (
                <>
                  <b className="text-ink">paired twice: with the car, and with its maker.</b> {car.maker.toLowerCase()} is listed and pairable on pons, so this curve is quoted in{" "}
                  <span className="mono text-bayside-2">{pair.symbol}</span> ({pair.name.toLowerCase()}) — you buy the first tokens with it and creator fees arrive in it.
                </>
              )}
            </div>

            <div className="mt-6">
              {taken ? (
                <ClaimedView car={car} claim={claim} fresh={launched} />
              ) : (
                <LaunchForm car={car} configured={configured} ponsLaunchFeeWei={ponsLaunchFeeWei} share={share} onLaunched={setLaunched} />
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
