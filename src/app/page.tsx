import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/landing/Hero";
import { LatestLaunches } from "@/components/landing/LatestLaunches";
import { Faq, Fees, HowItWorks, Teaser, WhyOne } from "@/components/landing/Sections";
import { readGarageQuick } from "@/lib/garage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await readGarageQuick();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <LatestLaunches initial={initial} />
        <HowItWorks />
        <Teaser />
        <WhyOne />
        <Fees />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
