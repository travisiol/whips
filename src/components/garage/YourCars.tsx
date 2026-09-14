"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { useMounted } from "@/components/ConnectButton";
import { TimeAgo } from "@/components/TimeAgo";
import { CAR_BY_ID } from "@/data/catalog";
import { PAIRS, type PairSymbol } from "@/data/pairs";
import { explorer, robinhoodChain } from "@/lib/chain";
import { formatUnitsTrim } from "@/lib/curvemath";
import { fmtCompact, fmtPct, shortAddress } from "@/lib/format";
import type { Claimed } from "@/lib/garage";
import { escrowAbi, PONS } from "@/lib/ponsAbi";

const STOCKS: PairSymbol[] = ["TSLA", "F", "RIVN"];

/**
 * The creator's corner of the garage: the cars this wallet claimed, what
 * they are worth right now, and the creator fees waiting in Pons' escrow —
 * with the button that claims them (escrow.claim() for ETH,
 * escrow.claimToken(pair) for a stock token). Fees still on a curve are
 * shown as accruing; Pons sweeps them to the escrow on its own schedule.
 */
export function YourCars({ claims, onSelect }: { claims: Claimed[]; onSelect: (itemId: number) => void }) {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === robinhoodChain.id;
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = address ?? ("0x0000000000000000000000000000000000000000" as Address);
  const mine = claims.filter((c) => address && c.launcher.toLowerCase() === address.toLowerCase());

  const { data: pending, refetch } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "balanceOf", args: [me], chainId: robinhoodChain.id },
      { address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "balanceOfToken", args: [PAIRS.TSLA.address, me], chainId: robinhoodChain.id },
      { address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "balanceOfToken", args: [PAIRS.F.address, me], chainId: robinhoodChain.id },
      { address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "balanceOfToken", args: [PAIRS.RIVN.address, me], chainId: robinhoodChain.id },
    ],
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  const pendingEth = pending?.[0]?.status === "success" ? pending[0].result : 0n;
  const pendingStock = STOCKS.map((s, i) => ({ symbol: s, wei: pending?.[i + 1]?.status === "success" ? (pending[i + 1].result as bigint) : 0n })).filter((p) => p.wei > 0n);
  const anythingPending = pendingEth > 0n || pendingStock.length > 0;

  if (!mounted || !address || (mine.length === 0 && !anythingPending && !note)) return null;

  async function claim(pair: PairSymbol | "ETH") {
    if (!publicClient) return;
    setBusy(true);
    setNote(null);
    try {
      const hash =
        pair === "ETH"
          ? await writeContractAsync({ address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "claim", chainId: robinhoodChain.id })
          : await writeContractAsync({ address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "claimToken", args: [PAIRS[pair].address], chainId: robinhoodChain.id });
      setNote(`claim submitted · ${shortAddress(hash, 8)}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setNote(receipt.status === "success" ? `paid out · ${shortAddress(hash, 8)}` : "the claim reverted.");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["garage"] });
    } catch (e) {
      setNote(e instanceof Error ? e.message.split("\n")[0] : "transaction failed");
    } finally {
      setBusy(false);
    }
  }

  const accruing = mine.reduce<Record<string, bigint>>((acc, c) => {
    acc[c.pair] = (acc[c.pair] ?? 0n) + BigInt(c.fees.accruingWei);
    return acc;
  }, {});

  return (
    <section className="card card-accent mt-8 p-5" aria-label="your cars">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="display text-[30px] text-ink">your cars</h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {mine.length === 0
              ? anythingPending
                ? "no car claimed from this wallet yet — but fees are waiting for it."
                : "nothing left to claim from this wallet."
              : `${mine.length} ${mine.length === 1 ? "car" : "cars"} launched from ${shortAddress(address)}. creator fees land in pons' escrow; claim them here.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={!onChain || busy || isPending || pendingEth === 0n} onClick={() => claim("ETH")}>
            claim {formatUnitsTrim(pendingEth, 18, 5)} eth
          </button>
          {pendingStock.map((p) => (
            <button key={p.symbol} type="button" className="btn btn-primary btn-sm" disabled={!onChain || busy || isPending} onClick={() => claim(p.symbol)}>
              claim {formatUnitsTrim(p.wei, PAIRS[p.symbol].decimals, 4)} {p.symbol.toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {note ? <p className="mono mt-2 text-[12px] text-ink-3">{note}</p> : null}
      {!onChain ? <p className="mono mt-2 text-[11px] text-ink-4">switch to robinhood chain to claim.</p> : null}

      {mine.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((c) => {
            const car = CAR_BY_ID.get(c.itemId)!;
            const q = c.pair.toLowerCase();
            return (
              <li key={c.itemId}>
                <button type="button" onClick={() => onSelect(c.itemId)} className="w-full rounded-2xl border border-line bg-floor p-3 text-left transition-colors hover:border-bayside/60">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="mono text-[14px] text-ink">${car.ticker.toLowerCase()}</span>
                    <span className="mono text-[11px] text-ink-4">{c.launchedAt ? <TimeAgo ts={c.launchedAt} /> : ""}</span>
                  </div>
                  <div className="truncate text-[12px] text-ink-2">{car.name.toLowerCase()}</div>
                  <div className="mono mt-2 flex justify-between text-[12px]">
                    <span className="text-ink-3">cap</span>
                    <span className="text-ink">
                      {fmtCompact(c.market.marketCap, 2)} {q}
                    </span>
                  </div>
                  <div className="mono flex justify-between text-[12px]">
                    <span className="text-ink-3">{c.market.graduated ? "status" : "to graduation"}</span>
                    <span className="text-ink-2">{c.market.graduated ? "graduated" : fmtPct(c.market.progressPct, 1)}</span>
                  </div>
                  <div className="mono flex justify-between text-[12px]">
                    <span className="text-ink-3">accruing on the curve</span>
                    <span className="text-ink-2">
                      {formatUnitsTrim(BigInt(c.fees.accruingWei), PAIRS[c.pair].decimals, 6)} {q}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
        pending in escrow is what pons already swept and you can withdraw now; accruing is your share of fees still sitting on each curve ({Object.entries(accruing).map(([k, v]) => `${formatUnitsTrim(v, PAIRS[k as PairSymbol].decimals, 6)} ${k.toLowerCase()}`).join(" · ") || "0"}), swept by pons on its own schedule.{" "}
        <a href={explorer.address(PONS.feeEscrow)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
          the escrow ↗
        </a>
      </p>
    </section>
  );
}
