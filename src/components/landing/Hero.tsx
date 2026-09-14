import Link from "next/link";
import { HeroScene } from "@/components/HeroScene";
import { SharePct } from "@/components/EarnLine";
import { CTA } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="floor-glow pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" />
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
        <p className="eyebrow rise text-center">
          built on <b>robinhood chain</b> · pons v2 · eth + tsla · f · rivn
        </p>
        <HeroScene className="mx-auto mt-2 h-[60vw] max-h-[560px] min-h-[300px] w-full max-w-5xl sm:h-[46vh]" />
        <div className="rise mx-auto mt-2 max-w-3xl text-center sm:-mt-6" style={{ animationDelay: "120ms" }}>
          <h1 className="display text-[13vw] leading-[0.9] text-ink sm:text-[88px]">
            launch tokens.
            <br />
            <span className="text-bayside-2">paired with cars.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
            pick a legend nobody has claimed. launch its token on robinhood chain in one transaction. <b className="text-ink">you earn <SharePct /> of every trade on it, forever</b> — the car becomes the token&apos;s identity, and you become its creator.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/garage?pick=1" className="btn btn-primary w-full sm:w-auto">
              {CTA.primary}
            </Link>
            <Link href="/garage" className="btn btn-ghost w-full sm:w-auto">
              {CTA.secondary}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
