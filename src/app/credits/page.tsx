import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { CARS } from "@/data/catalog";
import { photoOf } from "@/data/photos";

export const metadata: Metadata = {
  title: "photo credits",
  description: "every car photo on whips comes from wikimedia commons under a free licence. this is who took them.",
};

/**
 * The photographers. Every car photo is a Wikimedia Commons file under a
 * free licence (CC0, public domain, CC BY, CC BY-SA); attribution is the
 * licence's condition and it lives here and on each car's sheet.
 */
export default function CreditsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <h1 className="display text-[44px] text-ink sm:text-[64px]">photo credits</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          the cars you see are real, photographed by real people who published their work on wikimedia commons under free licences. we cut the backgrounds out and lit them; the credit stays with the photo. cars are references, not partners — nothing here is endorsed by any maker.
        </p>
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {CARS.map((car) => {
            const p = photoOf(car);
            if (!p) return null;
            return (
              <li key={car.id} className="grid gap-1 py-3 text-[13px] sm:grid-cols-[180px_1fr_auto] sm:items-baseline sm:gap-4">
                <Link href={`/garage?car=${car.slug}`} className="mono text-ink hover:text-bayside-2">
                  ${car.ticker.toLowerCase()} <span className="text-ink-3">· {car.name.toLowerCase()}</span>
                </Link>
                <span className="text-ink-2">
                  <a href={p.page} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                    {p.file.replace(/^File:/, "")}
                  </a>{" "}
                  — {p.author}
                </span>
                <a href={p.licenseUrl || p.page} target="_blank" rel="noreferrer" className="mono text-[12px] text-ink-3 hover:text-ink">
                  {p.license}
                </a>
              </li>
            );
          })}
        </ol>
      </main>
      <Footer />
    </>
  );
}
