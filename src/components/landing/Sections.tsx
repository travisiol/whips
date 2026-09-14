import Link from "next/link";
import { CarPhoto } from "@/components/CarPhoto";
import { SharePct } from "@/components/EarnLine";
import { CARS, TIERS, pairOf } from "@/data/catalog";
import { PAIRS } from "@/data/pairs";
import { fmtInt } from "@/lib/format";
import { CTA } from "@/lib/site";

/* ── how it works ─────────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "pick a car nobody has claimed",
    body: "120 legends, one token each. ticker, numbers and pair are already set — if the bay is open, it's yours. first come, first served.",
  },
  {
    n: "02",
    title: "launch it in one tap",
    body: "one transaction launches the token on pons v2 and buys your first tokens at the starting price. you are the creator on chain. nobody can launch a second $f40 here.",
  },
  {
    n: "03",
    title: "earn on every trade, forever",
    body: "pons pays the creator's share of its trade fee to your wallet — in eth, or in the maker's stock for tesla, ford and rivian. every buy, every sell, as long as the token trades.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="display text-[40px] text-ink sm:text-[56px]">how it works</h2>
        <p className="max-w-md text-sm text-ink-3">
          three steps, one transaction. you earn <b className="text-ink"><SharePct /> of every trade</b> on the car you launch.
        </p>
      </div>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card card-hover p-6">
            <span className="mono text-[12px] text-bayside-2">{s.n}</span>
            <h3 className="display mt-3 text-[26px] text-ink">{s.title}</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── catalog teaser ───────────────────────────────────────────────── */

const TEASER = ["f40", "r34", "mcf1", "countach", "cybertruck", "miura", "supra", "delorean"] as const;

export function Teaser() {
  const cars = TEASER.map((slug) => CARS.find((c) => c.slug === slug)!);
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="display text-[40px] text-ink sm:text-[56px]">the garage</h2>
        <div className="flex flex-wrap items-center gap-2">
          {TIERS.map((t) => (
            <Link key={t.id} href={`/garage#${t.floor}`} className="pill pill-sm">
              <span className="mono text-bayside-2">{t.floor}</span> {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="no-scrollbar mt-8 flex gap-4 overflow-x-auto pb-2">
        {cars.map((car) => {
          const pair = pairOf(car);
          return (
            <Link key={car.id} href={`/garage?car=${car.slug}`} className="card card-hover group w-[260px] shrink-0 p-4">
              <CarPhoto car={car} lit className="w-full [&_.car-photo-img]:group-hover:scale-[1.03]" />
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="mono text-[13px] text-ink">${car.ticker.toLowerCase()}</span>
                <span className="mono text-[11px] text-ink-3">{car.year}</span>
              </div>
              <div className="truncate text-[13px] text-ink-2">{car.name.toLowerCase()}</div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-ink-3">{car.units === null ? "units not disclosed" : `${car.approx ? "~" : ""}${fmtInt(car.units)} made`}</span>
                <span className={pair.symbol === "ETH" ? "text-ink-3" : "text-bayside-2"}>{pair.symbol.toLowerCase()} pair</span>
              </div>
            </Link>
          );
        })}
        <Link href="/garage" className="card card-hover flex w-[200px] shrink-0 flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="display text-[40px] text-ink">120</span>
          <span className="text-[13px] text-ink-2">cars, five floors</span>
          <span className="btn btn-ghost btn-sm mt-2">{CTA.secondary}</span>
        </Link>
      </div>
    </section>
  );
}

/* ── why one per car ──────────────────────────────────────────────── */

export function WhyOne() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="card overflow-hidden p-6 sm:p-10">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="display text-[40px] text-ink sm:text-[56px]">why one per car</h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
              a token needs an identity, and an identity needs to be scarce. the catalog is a fixed list committed to the launcher as a merkle root: you can only claim a car with its real name, its real ticker and its real pair, and the launcher refuses a second claim of the same car.
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">
              so the f40 is one token. whoever claims it first is its creator, earns its creator fees and appears on its sheet. everyone else sees{" "}
              <span className="mono text-[13px] text-ink">taken · $f40 · 0x…</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["120", "cars in the catalog"],
              ["1", "token per car, ever"],
              ["1", "transaction to launch and buy"],
              ["0", "platform fee, platform token"],
            ].map(([v, k]) => (
              <div key={k} className="rounded-2xl border border-line bg-floor p-5">
                <dt className="display text-[44px] leading-none text-ink">{v}</dt>
                <dd className="mt-2 text-[13px] text-ink-3">{k}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── who earns the fees ───────────────────────────────────────────── */

export function Fees() {
  return (
    <section id="fees" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6">
      <h2 className="display text-[40px] text-ink sm:text-[56px]">who earns the fees</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card card-accent p-6">
          <span className="label">you, the creator</span>
          <p className="display mt-2 text-[28px] leading-tight text-ink">
            <SharePct /> of every trade
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            pons takes a 1% fee on every buy and sell on the curve and pays the creator&apos;s share to the token&apos;s fee recipient. our launcher sets that recipient to <b className="text-ink">the wallet that claimed the car</b>. that&apos;s pons, native; we&apos;re not in the path and take nothing.
          </p>
        </div>
        <div className="card p-6">
          <span className="label">creator tax</span>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            at launch you can add a creator tax on top, from 0 up to the factory&apos;s maximum. it goes to the same wallet, the same way. the default here is 0.
          </p>
        </div>
        <div className="card p-6">
          <span className="label">paired with the maker</span>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            when the maker is listed and pairable on pons, the curve is quoted in its stock token — {Object.values(PAIRS).filter((p) => p.maker).map((p) => `${p.maker!.toLowerCase()} → ${p.symbol.toLowerCase()}`).join(", ")}. fees on those curves arrive in the stock token. everything else pairs with eth.
          </p>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-ink-4">
        the split between creator and protocol is read from each curve on chain (protocolFeeShareBps) and shown on the car&apos;s sheet; pons sweeps fees from the curve to its escrow on its own schedule.
      </p>
    </section>
  );
}

/* ── faq ──────────────────────────────────────────────────────────── */

const FAQ = [
  {
    q: "what exactly happens when i press start your engine?",
    a: "one transaction to our launcher. it checks the merkle proof for the car you picked, forwards the launch to pons v2's launch forwarder with your wallet as creator-fee recipient and buy recipient, and buys your first tokens in the same call. the launcher stores the claim and the bay reads as taken.",
  },
  {
    q: "what exists once my launch confirms?",
    a: "a real erc-20 on robinhood chain, deployed by the pons v2 factory like every other pons token, with its name, ticker, logo, description and socials stored in the token contract itself — plus its bonding curve, where you hold the first tokens. your sheet flips to the market view with the contract address (copy it, share it), the garage shows the bay as taken to everyone within 15 seconds, and the token trades on the curve here and on pons under the same address. when the curve reaches its threshold (4.2 eth on an eth pair), pons graduates it to a pool.",
  },
  {
    q: "where do my fees go, and how do i get them?",
    a: "every buy and sell pays pons' fee on the curve; your share accrues there and pons sweeps it to its fee escrow on its own schedule. the garage shows both numbers for your cars (accruing on the curve · pending in the escrow) and a claim button that calls the escrow — claim() for eth, claimToken() for a stock pair. the money goes to the wallet that launched, nobody else can claim it.",
  },
  {
    q: "can i change the name or the ticker?",
    a: "no. the name, ticker and pair are the car's identity and they're what the proof commits to. you choose the logo, the description, the socials, the creator tax and the size of your first buy.",
  },
  {
    q: "what does it cost?",
    a: "pons' launch fee (read live from the factory, 0.0005 eth at the time of writing) plus your first buy. the launcher itself takes nothing.",
  },
  {
    q: "what's a stock pair?",
    a: "some cars are made by companies whose stock tokens pons accepts as a pair: tesla, ford and rivian. their curves are quoted in tsla, f or rivn instead of eth, so you buy the first tokens with the stock token, and creator fees arrive in it. the sheet says so on every one of them.",
  },
  {
    q: "is the token address predictable?",
    a: "the salt is derived from the car. the pons factory mixes the sender into it and refuses the same salt twice from the same sender — so on this launcher every car maps to exactly one address, guaranteed twice: our already-claimed check, and the factory's own refusal behind it. a second launcher would mint different addresses, which is why there is one launcher.",
  },
  {
    q: "are the numbers on the cards real?",
    a: "market cap, progress and holders are read from robinhood chain every 15 seconds. spec figures (0–100, top speed, units made) are catalog data; a tilde marks a figure rounded from published tests, and 'not disclosed' means the maker never published one — we don't invent them.",
  },
  {
    q: "are you affiliated with the makers?",
    a: "no. cars are references, not partners. nothing here is endorsed by any manufacturer.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6">
      <h2 className="display text-[40px] text-ink sm:text-[56px]">faq</h2>
      <div className="mt-8 divide-y divide-line border-y border-line">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="mono text-ink-3 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
