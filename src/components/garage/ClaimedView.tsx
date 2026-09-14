"use client";

import type { LaunchResult } from "@/components/garage/LaunchForm";
import { TradePanel } from "@/components/garage/TradePanel";
import { CopyButton } from "@/components/CopyButton";
import { TimeAgo } from "@/components/TimeAgo";
import { ponsTradeUrl } from "@/lib/chain";
import { site } from "@/lib/site";
import { pairOf, type Car } from "@/data/catalog";
import { explorer } from "@/lib/chain";
import { fmtCompact, fmtPct, fmtQuote, shortAddress, toUnits } from "@/lib/format";
import type { Claimed } from "@/lib/garage";
import { useCarDetail } from "@/lib/useGarage";

/**
 * A taken bay: the live market read from the curve, trading, holders and
 * recent trades from logs, and the creator fees the launcher earns. `fresh`
 * bridges the seconds between a confirmed launch and the next garage read.
 */
export function ClaimedView({ car, claim, fresh }: { car: Car; claim: Claimed | null; fresh: LaunchResult | null }) {
  const pair = pairOf(car);
  const detail = useCarDetail(car.id, claim !== null);
  const token = claim?.token ?? fresh?.token ?? null;
  const curve = claim?.curve ?? fresh?.curve ?? null;
  const q = (claim?.pair ?? pair.symbol).toLowerCase();

  if (!token || !curve) return null;

  return (
    <div className="space-y-4">
      <div className="card card-accent p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="mono text-[12px] text-ink-3">
            taken · ${car.ticker.toLowerCase()} · <span className="whitespace-nowrap">{shortAddress(claim?.launcher ?? fresh?.launcher ?? "")}</span>
          </span>
          {claim?.launchedAt ? <span className="mono whitespace-nowrap text-[11px] text-ink-4"><TimeAgo ts={claim.launchedAt} prefix="launched " fallback="launched" /></span> : null}
        </div>
        {claim ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat k="market cap" v={`${fmtCompact(claim.market.marketCap, 2)} ${q}`} />
              <Stat k="price" v={fmtQuote(claim.market.price, q)} />
              <Stat k="raised" v={fmtQuote(claim.market.raised, q)} />
              <Stat k={claim.market.graduated ? "status" : "to graduation"} v={claim.market.graduated ? "graduated" : fmtPct(claim.market.progressPct, 1)} />
            </div>
            <div className="bar mt-4">
              <i style={{ width: `${Math.max(2, claim.market.graduated ? 100 : claim.market.progressPct)}%` }} />
            </div>
            <div className="mono mt-2 flex justify-between text-[11px] text-ink-4">
              <span>
                {fmtQuote(claim.market.raised, q)} of {fmtQuote(claim.market.threshold, q)}
              </span>
              <span>supply {fmtCompact(claim.market.launchSupply, 0)}</span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[13px] text-ink-3">just launched — the market appears at the next chain read, within 15 seconds.</p>
        )}
        {/* The contract address, the thing people paste everywhere */}
        <div className="mt-4 rounded-xl border border-line bg-floor p-3">
          <div className="label">contract address (ca)</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="mono min-w-0 flex-1 truncate text-[12px] text-ink">{token}</code>
            <CopyButton value={token} label="copy ca" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn btn-ghost btn-sm !h-8 !px-3 !text-[12px]" href={explorer.token(token)} target="_blank" rel="noreferrer">
              explorer ↗
            </a>
            <a className="btn btn-ghost btn-sm !h-8 !px-3 !text-[12px]" href={ponsTradeUrl(token)} target="_blank" rel="noreferrer">
              on pons ↗
            </a>
            <a
              className="btn btn-ghost btn-sm !h-8 !px-3 !text-[12px]"
              href={`https://x.com/intent/post?text=${encodeURIComponent(`$${car.ticker} — ${car.name.toLowerCase()} is live on robinhood chain, paired with ${q}. one token, one car, claimed once.
ca ${token}
${site.url}/garage?car=${car.slug}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              share on x ↗
            </a>
          </div>
          <div className="mono mt-2 truncate text-[11px] text-ink-4">curve · {curve}</div>
        </div>

        {/* What the token contract itself says — proof the identity landed on chain */}
        {detail.data?.meta ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-floor p-3">
            {detail.data.meta.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.data.meta.logo} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl border border-line object-cover" />
            ) : null}
            <div className="min-w-0 text-[12px] leading-snug">
              <div className="text-ink">
                on chain: <span className="mono">{detail.data.meta.name}</span> · <span className="mono">${detail.data.meta.symbol}</span>
              </div>
              <div className="truncate text-ink-3">{detail.data.meta.description || "no description"}</div>
              <div className="mono text-[11px] leading-relaxed text-ink-4">
                read from the token contract · deployer {shortAddress(detail.data.meta.deployer, 6)} is the whips launcher
                {claim ? ` · creator fees → ${shortAddress(claim.launcher, 6)}` : ""}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <TradePanel token={token} curve={curve} symbol={car.ticker} pair={claim?.pair ?? pair.symbol} graduated={claim?.market.graduated ?? false} />

      {/* Holders & trades */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="display text-[22px] text-ink">holders</h3>
          <span className="mono text-[12px] text-ink-3">{detail.data ? `${detail.data.holders.count} wallets` : detail.isLoading ? "reading logs…" : "—"}</span>
        </div>
        {detail.data?.holders.top.length ? (
          <ol className="mt-3 space-y-1.5">
            {detail.data.holders.top.map((h, i) => (
              <li key={h.address} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="mono text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <a href={explorer.address(h.address)} target="_blank" rel="noreferrer" className="mono flex-1 truncate text-ink-2 hover:text-ink">
                  {shortAddress(h.address, 6)}
                  {claim && h.address.toLowerCase() === claim.launcher.toLowerCase() ? <span className="ml-2 text-bayside-2">creator</span> : null}
                </a>
                <span className="mono text-ink">{fmtPct(h.pct, 2)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-[13px] text-ink-4">{detail.data ? "no holders read yet." : ""}</p>
        )}
        {detail.data?.holders.sampled ? <p className="mt-2 text-[11px] text-ink-4">launch block unknown — holders read from the last 400k blocks only.</p> : null}

        <h3 className="display mt-6 text-[22px] text-ink">recent trades</h3>
        {detail.data?.trades.length ? (
          <ul className="mt-3 space-y-1.5">
            {detail.data.trades.slice(0, 12).map((t) => (
              <li key={t.txHash + t.side + t.account} className="flex items-center justify-between gap-3 text-[12px]">
                <span className={`mono w-9 ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side}</span>
                <a href={explorer.tx(t.txHash)} target="_blank" rel="noreferrer" className="mono flex-1 truncate text-ink-2 hover:text-ink">
                  {shortAddress(t.account, 5)}
                </a>
                <span className="mono text-ink-2">{fmtCompact(toUnits(t.tokenAmount, 18), 1)}</span>
                <span className="mono w-24 text-right text-ink">{fmtQuote(toUnits(t.quoteAmount, pair.decimals), q)}</span>
                <span className="mono w-14 text-right text-ink-4"><TimeAgo ts={t.timestamp} /></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-ink-4">{detail.data ? "no trades yet." : detail.isLoading ? "reading logs…" : ""}</p>
        )}
      </div>

      {/* Creator fees */}
      {claim ? (
        <div className="card p-5">
          <h3 className="display text-[22px] text-ink">creator fees</h3>
          <p className="mt-2 text-[13px] text-ink-3">
            pons pays the creator&apos;s share of the {(claim.market.feeBps / 100).toFixed(0)}% trade fee{claim.market.creatorTaxBps > 0 ? ` plus the ${(claim.market.creatorTaxBps / 100).toFixed(1)}% creator tax` : ""} to{" "}
            <a className="mono text-ink hover:underline" href={explorer.address(claim.launcher)} target="_blank" rel="noreferrer">
              {shortAddress(claim.launcher, 6)}
            </a>
            , the wallet that claimed this bay.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat k="pending in the pons escrow" v={fmtQuote(toUnits(claim.fees.pendingWei, pair.decimals), q)} />
            <Stat k="accruing on the curve" v={fmtQuote(toUnits(claim.fees.accruingWei, pair.decimals), q)} />
          </div>
          <p className="mt-3 text-[11px] text-ink-4">
            creator share {((10_000 - claim.market.protocolFeeShareBps) / 100).toFixed(0)}% of fees, read from the curve. fees sit on the curve until pons sweeps them to its escrow; the creator claims from the escrow.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-floor p-3">
      <div className="label">{k}</div>
      <div className="mono mt-1 break-words text-[13px] leading-snug text-ink">{v}</div>
    </div>
  );
}
