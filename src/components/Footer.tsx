import Link from "next/link";
import { PONS } from "@/lib/ponsAbi";
import { explorer } from "@/lib/chain";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <div className="display text-[28px] text-ink">{site.name}</div>
            <p className="mt-2 text-sm text-ink-3">{site.tagline}</p>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-3">{site.disclaimer}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="label">site</span>
              <Link href="/garage" className="text-ink-2 hover:text-ink">garage</Link>
              <Link href="/#how" className="text-ink-2 hover:text-ink">how it works</Link>
              <Link href="/#fees" className="text-ink-2 hover:text-ink">who earns the fees</Link>
              <Link href="/#faq" className="text-ink-2 hover:text-ink">faq</Link>
              <Link href="/credits" className="text-ink-2 hover:text-ink">photo credits</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">chain</span>
              <a href={explorer.address(PONS.factory)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">pons v2 factory ↗</a>
              <a href={explorer.address(PONS.forwarder)} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">launch forwarder ↗</a>
              <a href="https://www.ponsfamily.com" target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">pons ↗</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">notes</span>
              <span className="text-ink-3">cars are references, not partners.</span>
              <span className="text-ink-3">not affiliated with any maker.</span>
              <span className="text-ink-3">photos: wikimedia commons, free licences, credited.</span>
              <span className="text-ink-3">tokens on a bonding curve can go to zero.</span>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-[12px] text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <span>built on robinhood chain · pons v2 · eth + tsla · f · rivn</span>
          <span>archivo by omnibus-type, ofl · photos by their authors, see credits</span>
        </div>
      </div>
    </footer>
  );
}
