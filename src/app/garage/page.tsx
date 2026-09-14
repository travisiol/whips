import { Suspense } from "react";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Garage } from "@/components/garage/Garage";
import { readGarageQuick } from "@/lib/garage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "the garage",
  description: "120 cars, five floors. pick an open bay and launch its token on robinhood chain.",
};

export default async function GaragePage() {
  const initial = await readGarageQuick();
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={<div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6"><h1 className="display text-[44px] text-ink sm:text-[64px]">the garage</h1></div>}>
          <Garage initial={initial} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
