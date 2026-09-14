"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/ConnectButton";
import { CTA, site } from "@/lib/site";

const LINKS = [
  { href: "/garage", label: "garage" },
  { href: "/#how", label: "how it works" },
  { href: "/#fees", label: "fees" },
  { href: "/#faq", label: "faq" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40">
      <div className="glass-panel border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="display text-[26px] text-ink hover:text-white" aria-label={`${site.name} home`}>
            {site.name}
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="main">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-2 text-[13px] lowercase transition-colors ${pathname === l.href ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ConnectButton />
            <Link href="/garage?pick=1" className="btn btn-primary btn-sm hidden sm:inline-flex">
              {CTA.primary}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
