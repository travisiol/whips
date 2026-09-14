"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bay } from "@/components/garage/Bay";
import { CarSheet } from "@/components/garage/CarSheet";
import { YourCars } from "@/components/garage/YourCars";
import { TimeAgo } from "@/components/TimeAgo";
import { CARS, CAR_BY_SLUG, DECADES, MAKERS, TIERS, decadeOf, pairOf, type Car, type Tier } from "@/data/catalog";
import { PAIRS, type PairSymbol } from "@/data/pairs";
import { useGarage } from "@/lib/useGarage";
import { creatorSharePct, type Claimed, type GarageState } from "@/lib/garage";


type TierFilter = Tier | "all";
type PairFilter = PairSymbol | "all";

/**
 * The garage: one screen, five floors, one per tier. Filters by maker,
 * decade, tier and pair, plus search. Empty bays are unclaimed cars;
 * parked cars are claimed, with their live cap. Clicking a bay slides the
 * car's sheet in from the right. On phones the floors are a swipe
 * carousel, one at a time.
 */
export function Garage({ initial }: { initial?: GarageState }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { state, claims, isLoading, isError } = useGarage(initial);

  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [pair, setPair] = useState<PairFilter>("all");
  const [maker, setMaker] = useState<string>("all");
  const [decade, setDecade] = useState<string>("all");
  const [mobileFloor, setMobileFloor] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const pickMode = params.get("pick") === "1";
  const selectedSlug = params.get("car");
  const selected = selectedSlug ? (CAR_BY_SLUG.get(selectedSlug) ?? null) : null;

  const select = useCallback(
    (car: Car | null) => {
      const next = new URLSearchParams(params.toString());
      if (car) next.set("car", car.slug);
      else next.delete("car");
      next.delete("pick");
      router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CARS.filter((c) => {
      if (tier !== "all" && c.tier !== tier) return false;
      if (pair !== "all" && pairOf(c).symbol !== pair) return false;
      if (maker !== "all" && c.maker !== maker) return false;
      if (decade !== "all" && decadeOf(c) !== decade) return false;
      if (q && !`${c.name} ${c.maker} ${c.ticker} ${c.year}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, tier, pair, maker, decade]);

  const floors = TIERS.map((t) => ({ tier: t, cars: filtered.filter((c) => c.tier === t.id) })).filter((f) => tier === "all" || f.tier.id === tier);
  const claimedCount = state?.claims.length ?? 0;
  const share = creatorSharePct(state);

  // Keep the mobile floor index in sync with the carousel's scroll position.
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setMobileFloor(i);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [floors.length]);

  const scrollToFloor = (i: number) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setMobileFloor(i);
  };

  const status = !state
    ? isLoading
      ? "reading the chain…"
      : isError
        ? "couldn't reach the chain — showing the catalog"
        : ""
    : !state.configured
      ? "nothing launched yet. the garage is empty."
      : claimedCount === 0
        ? "nothing launched yet. the garage is empty."
        : (
          <>
            {claimedCount} of {CARS.length} claimed · <TimeAgo ts={state.readAt} prefix="read " fallback="read" /> at block {state.blockNumber.toLocaleString("en-US")}
          </>
        );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-[44px] text-ink sm:text-[64px]">the garage</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-snug text-ink-2">
            120 cars, one token each. claim a car nobody has taken, launch its token in one tap, and <b className="text-ink">earn {share.toFixed(1)}% of every trade on it</b> — in eth, or in the maker&apos;s stock.
          </p>
          <p className="mono mt-2 text-[12px] text-ink-3" aria-live="polite">
            {status}
            {state?.error ? ` · ${state.error}` : ""}
          </p>
        </div>
        {pickMode ? (
          <div className="rounded-2xl border border-bayside/50 bg-bayside/10 px-4 py-3 text-[13px] text-ink">
            pick any car sitting in the dark — those bays are open. a car under its ring of light is already taken.
          </div>
        ) : null}
      </div>

      <YourCars claims={state?.claims ?? []} onSelect={(id) => select(CARS.find((c) => c.id === id) ?? null)} />

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field max-w-xs"
            placeholder="search a car, a maker, a ticker…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="search"
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="floor">
            <button type="button" className="pill" aria-pressed={tier === "all"} onClick={() => setTier("all")}>
              all floors
            </button>
            {TIERS.map((t) => (
              <button key={t.id} type="button" className="pill" aria-pressed={tier === t.id} onClick={() => setTier(t.id)}>
                <span className="mono text-bayside-2">{t.floor}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="pair">
            {(["all", ...Object.keys(PAIRS)] as PairFilter[]).map((p) => (
              <button key={p} type="button" className="pill pill-sm" aria-pressed={pair === p} onClick={() => setPair(p)}>
                {p === "all" ? "any pair" : `${p.toLowerCase()} pair`}
              </button>
            ))}
          </div>
          <select className="field h-9 w-auto !py-0 text-[13px]" value={maker} onChange={(e) => setMaker(e.target.value)} aria-label="maker">
            <option value="all">any maker</option>
            {MAKERS.map((m) => (
              <option key={m} value={m}>
                {m.toLowerCase()}
              </option>
            ))}
          </select>
          <select className="field h-9 w-auto !py-0 text-[13px]" value={decade} onChange={(e) => setDecade(e.target.value)} aria-label="decade">
            <option value="all">any decade</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {search || tier !== "all" || pair !== "all" || maker !== "all" || decade !== "all" ? (
            <button
              type="button"
              className="text-[12px] text-ink-3 underline hover:text-ink"
              onClick={() => {
                setSearch("");
                setTier("all");
                setPair("all");
                setMaker("all");
                setDecade("all");
              }}
            >
              clear
            </button>
          ) : null}
          <span className="mono ml-auto text-[11px] text-ink-4">{filtered.length} cars</span>
        </div>
      </div>

      {/* Desktop: floors stacked. Mobile: one floor at a time, swipe. */}
      <div className="mt-8 hidden md:block">
        {floors.map(({ tier: t, cars }) => (
          <Floor key={t.id} tier={t} cars={cars} claims={claims} onSelect={select} pickMode={pickMode} share={share} />
        ))}
        {floors.every((f) => f.cars.length === 0) ? <p className="py-20 text-center text-ink-3">no car matches that. clear the filters.</p> : null}
      </div>

      <div className="mt-6 md:hidden">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="floors">
          {floors.map((f, i) => (
            <button key={f.tier.id} type="button" role="tab" aria-selected={mobileFloor === i} className="pill pill-sm" data-on={mobileFloor === i} onClick={() => scrollToFloor(i)}>
              <span className="mono text-bayside-2">{f.tier.floor}</span> {f.tier.label}
            </button>
          ))}
        </div>
        <div ref={carouselRef} className="no-scrollbar snap-x mt-2 flex overflow-x-auto">
          {floors.map(({ tier: t, cars }) => (
            <div key={t.id} className="w-full shrink-0">
              <Floor tier={t} cars={cars} claims={claims} onSelect={select} pickMode={pickMode} share={share} />
            </div>
          ))}
        </div>
        <p className="mono mt-2 text-center text-[11px] text-ink-4">swipe for the next floor</p>
      </div>

      <CarSheet car={selected} claim={selected ? (claims.get(selected.id) ?? null) : null} configured={state?.configured ?? false} ponsLaunchFeeWei={state?.ponsLaunchFeeWei ?? "0"} share={share} onClose={() => select(null)} />
    </div>
  );
}

function Floor({ tier, cars, claims, onSelect, pickMode, share }: { tier: (typeof TIERS)[number]; cars: Car[]; claims: Map<number, Claimed>; onSelect: (car: Car) => void; pickMode: boolean; share: number }) {
  const total = CARS.filter((c) => c.tier === tier.id).length;
  const taken = CARS.filter((c) => c.tier === tier.id && claims.has(c.id)).length;
  return (
    <section id={tier.floor} className="scroll-mt-24 py-6">
      <header className="flex flex-col gap-1 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className="display text-[40px] text-bayside-2">{tier.floor}</span>
          <h2 className="display text-[32px] text-ink">{tier.label}</h2>
        </div>
        <div className="text-[13px] text-ink-3">
          {tier.line} <span className="mono text-ink-4">· {taken}/{total} taken</span>
        </div>
      </header>
      {cars.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-4">no car on this floor matches the filters.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cars.map((car) => (
            <Bay key={car.id} car={car} claim={claims.get(car.id) ?? null} onSelect={onSelect} pickMode={pickMode} creatorSharePct={share} />
          ))}
        </div>
      )}
    </section>
  );
}
