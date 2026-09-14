"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useAccount, useBalance, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton, useMounted } from "@/components/ConnectButton";
import { PAIRS, ZERO_ADDRESS, type PairSymbol } from "@/data/pairs";
import { explorer, ponsTradeUrl, robinhoodChain } from "@/lib/chain";
import { BPS, formatUnitsTrim, parseDecimal, priceImpactBps, quoteBuy, quoteSell, sellImpactBps, withSlippage } from "@/lib/curvemath";
import { shortAddress } from "@/lib/format";
import { curveAbi, erc20Abi } from "@/lib/ponsAbi";

const SLIPPAGE_OPTIONS = [50n, 100n, 300n] as const;
type Side = "buy" | "sell";

/**
 * Buy and sell on the token's own Pons curve, from the sheet. Quotes are
 * the curve's constant product computed locally from its reserves (checked
 * to the wei against launches on a fork); the trade is a direct call to the
 * curve — the launcher is not in the path. On a native curve the buy
 * carries the quote as value (quoteAmount == msg.value); on a stock-paired
 * curve the pair token is approved to the curve and pulled by it.
 */
export function TradePanel({ token, curve, symbol, pair, graduated }: { token: Address; curve: Address; symbol: string; pair: PairSymbol; graduated: boolean }) {
  const pairInfo = PAIRS[pair];
  const stock = pair !== "ETH";
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState<bigint>(100n);
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<`0x${string}` | undefined>();
  const mounted = useMounted();
  const queryClient = useQueryClient();

  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === robinhoodChain.id;
  const account = address ?? (ZERO_ADDRESS as Address);

  const { data: eth, refetch: refetchEth } = useBalance({ address, chainId: robinhoodChain.id, query: { enabled: Boolean(address) } });
  const { data: reads, refetch } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: curve, abi: curveAbi, functionName: "getReserves", chainId: robinhoodChain.id },
      { address: curve, abi: curveAbi, functionName: "feeBps", chainId: robinhoodChain.id },
      { address: curve, abi: curveAbi, functionName: "creatorTaxBps", chainId: robinhoodChain.id },
      { address: curve, abi: curveAbi, functionName: "currentSnipeTaxBps", args: [account], chainId: robinhoodChain.id },
      { address: token, abi: erc20Abi, functionName: "balanceOf", args: [account], chainId: robinhoodChain.id },
      { address: token, abi: erc20Abi, functionName: "allowance", args: [account, curve], chainId: robinhoodChain.id },
      { address: pairInfo.address, abi: erc20Abi, functionName: "balanceOf", args: [account], chainId: robinhoodChain.id },
      { address: pairInfo.address, abi: erc20Abi, functionName: "allowance", args: [account, curve], chainId: robinhoodChain.id },
    ],
    query: { refetchInterval: 8_000 },
  });

  const reserves = reads?.[0]?.status === "success" ? (reads[0].result as readonly [bigint, bigint]) : null;
  const feeBps = reads?.[1]?.status === "success" ? (reads[1].result as bigint) : 100n;
  const creatorTax = reads?.[2]?.status === "success" ? (reads[2].result as bigint) : 0n;
  const snipeTax = reads?.[3]?.status === "success" ? (reads[3].result as bigint) : 0n;
  const tokenBalance = reads?.[4]?.status === "success" ? (reads[4].result as bigint) : 0n;
  const tokenAllowance = reads?.[5]?.status === "success" ? (reads[5].result as bigint) : 0n;
  const pairBalance = stock && reads?.[6]?.status === "success" ? (reads[6].result as bigint) : 0n;
  const pairAllowance = stock && reads?.[7]?.status === "success" ? (reads[7].result as bigint) : 0n;

  const { writeContractAsync, isPending } = useWriteContract();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: pending, chainId: robinhoodChain.id });
  const inFlight = Boolean(pending) && !receipt;
  useEffect(() => {
    if (!receipt) return;
    refetch();
    refetchEth();
    queryClient.invalidateQueries({ queryKey: ["garage"] });
    queryClient.invalidateQueries({ queryKey: ["car"] });
  }, [receipt, refetch, refetchEth, queryClient]);
  const status = receipt
    ? { kind: receipt.status === "success" ? ("info" as const) : ("error" as const), text: receipt.status === "success" ? `confirmed · ${shortAddress(receipt.transactionHash, 8)}` : "the transaction reverted." }
    : note;

  const amountIn = useMemo(() => parseDecimal(amount, side === "buy" ? pairInfo.decimals : 18), [amount, side, pairInfo.decimals]);

  const quote = useMemo(() => {
    if (!reserves || !amountIn || amountIn <= 0n) return null;
    const [q, t] = reserves;
    if (side === "buy") {
      const out = quoteBuy(q, t, amountIn, feeBps, creatorTax + snipeTax);
      const net = amountIn - (amountIn * (feeBps + creatorTax + snipeTax)) / BPS;
      return { out, impact: priceImpactBps(q, t, net, out), min: withSlippage(out, slippage) };
    }
    const out = quoteSell(q, t, amountIn, feeBps, creatorTax);
    return { out, impact: sellImpactBps(q, t, amountIn), min: withSlippage(out, slippage) };
  }, [reserves, amountIn, side, feeBps, creatorTax, snipeTax, slippage]);

  const needsTokenApproval = side === "sell" && amountIn !== null && amountIn > 0n && tokenAllowance < amountIn;
  const needsPairApproval = side === "buy" && stock && amountIn !== null && amountIn > 0n && pairAllowance < amountIn;
  const insufficient = side === "buy" ? (stock ? Boolean(amountIn && amountIn > pairBalance) : Boolean(eth && amountIn && amountIn > eth.value)) : Boolean(amountIn && amountIn > tokenBalance);
  const heavy = quote !== null && quote.impact > 1_000n;
  const canTrade = mounted && onChain && amountIn !== null && amountIn > 0n && quote !== null && quote.out > 0n && !insufficient && !isPending && !inFlight;

  async function submit() {
    if (!address || !amountIn || !quote) return;
    setNote(null);
    setPending(undefined);
    try {
      if (side === "buy") {
        if (needsPairApproval) {
          const hash = await writeContractAsync({ address: pairInfo.address, abi: erc20Abi, functionName: "approve", args: [curve, amountIn], chainId: robinhoodChain.id });
          setPending(hash);
          setNote({ kind: "info", text: `approval submitted · ${shortAddress(hash, 8)} — then buy.` });
          return;
        }
        const hash = await writeContractAsync({ address: curve, abi: curveAbi, functionName: "buy", args: [amountIn, quote.min, address], value: stock ? 0n : amountIn, chainId: robinhoodChain.id });
        setPending(hash);
        setNote({ kind: "info", text: `buy submitted · ${shortAddress(hash, 8)}` });
      } else if (needsTokenApproval) {
        const hash = await writeContractAsync({ address: token, abi: erc20Abi, functionName: "approve", args: [curve, amountIn], chainId: robinhoodChain.id });
        setPending(hash);
        setNote({ kind: "info", text: `approval submitted · ${shortAddress(hash, 8)} — then sell.` });
      } else {
        const hash = await writeContractAsync({ address: curve, abi: curveAbi, functionName: "sell", args: [amountIn, quote.min, address], chainId: robinhoodChain.id });
        setPending(hash);
        setNote({ kind: "info", text: `sell submitted · ${shortAddress(hash, 8)}` });
      }
    } catch (err) {
      setNote({ kind: "error", text: err instanceof Error ? err.message.split("\n")[0] : "transaction failed" });
    }
  }

  if (graduated) {
    return (
      <div className="card p-5">
        <h3 className="display text-[22px] text-ink">trade</h3>
        <p className="mt-2 text-sm text-ink-3">this token graduated: its market lives in the pool now, not on the curve this sheet reads.</p>
        <a href={ponsTradeUrl(token)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-4">
          trade on pons ↗
        </a>
      </div>
    );
  }

  const sym = symbol.toLowerCase();
  const quoteSym = pair.toLowerCase();
  const balanceLine = side === "buy" ? (stock ? `${formatUnitsTrim(pairBalance, pairInfo.decimals, 4)} ${quoteSym} available` : eth ? `${formatUnitsTrim(eth.value, 18, 4)} eth available` : "—") : `${formatUnitsTrim(tokenBalance, 18, 0)} ${sym} in wallet`;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="display text-[22px] text-ink">trade on the curve</h3>
        <div className="flex gap-1" role="tablist" aria-label="side">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={side === s}
              className="pill pill-sm"
              data-on={side === s}
              onClick={() => {
                setSide(s);
                setAmount("");
                setNote(null);
                setPending(undefined);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-2 flex items-baseline justify-between">
          <span className="label">{side === "buy" ? `you pay (${quoteSym})` : `you sell (${sym})`}</span>
          <button
            type="button"
            className="text-[11px] text-ink-3 hover:text-ink"
            onClick={() => {
              if (side === "buy" && !stock && eth) {
                const spare = eth.value - 1_000_000_000_000_000n;
                setAmount(spare > 0n ? formatUnitsTrim(spare, 18, 6) : "0");
              } else if (side === "buy" && stock) setAmount(formatUnitsTrim(pairBalance, pairInfo.decimals, 6));
              else if (side === "sell") setAmount(formatUnitsTrim(tokenBalance, 18, 18));
            }}
          >
            {balanceLine} · max
          </button>
        </span>
        <input className="field mono text-lg" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(amount && amountIn === null)} />
      </label>

      <dl className="mt-4 space-y-1.5 text-[13px]">
        <Row k={side === "buy" ? `you get (${sym})` : `you get (${quoteSym})`}>
          <span className="mono text-ink">{quote ? formatUnitsTrim(quote.out, side === "buy" ? 18 : pairInfo.decimals, side === "buy" ? 0 : 6) : "—"}</span>
        </Row>
        <Row k="minimum after slippage">
          <span className="mono text-ink-2">{quote ? formatUnitsTrim(quote.min, side === "buy" ? 18 : pairInfo.decimals, side === "buy" ? 0 : 6) : "—"}</span>
        </Row>
        <Row k="price impact">
          <span className={`mono ${heavy ? "text-down" : "text-ink-2"}`}>{quote ? `${(Number(quote.impact) / 100).toFixed(2)}%${heavy ? " · large" : ""}` : "—"}</span>
        </Row>
        <Row k="fees">
          <span className="mono text-ink-2">
            {(Number(feeBps + creatorTax) / 100).toFixed(2)}%{side === "buy" && snipeTax > 0n ? ` + ${(Number(snipeTax) / 100).toFixed(2)}% snipe tax` : ""}
          </span>
        </Row>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="label">slippage</span>
        <div className="flex gap-1" role="radiogroup" aria-label="slippage tolerance">
          {SLIPPAGE_OPTIONS.map((s) => (
            <button key={String(s)} type="button" role="radio" aria-checked={slippage === s} className="pill pill-sm" data-on={slippage === s} onClick={() => setSlippage(s)}>
              {(Number(s) / 100).toFixed(1)}%
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {!mounted || !isConnected || !onChain ? (
          <ConnectButton size="md" />
        ) : (
          <button type="button" className={`btn w-full ${side === "buy" ? "btn-primary" : "btn-ghost"}`} disabled={!canTrade} onClick={submit}>
            {isPending
              ? "confirm in wallet…"
              : inFlight
                ? "waiting for the chain…"
                : insufficient
                  ? `not enough ${side === "buy" ? quoteSym : sym}`
                  : side === "buy"
                    ? needsPairApproval
                      ? `approve ${quoteSym}`
                      : `buy ${sym}`
                    : needsTokenApproval
                      ? `approve ${sym}`
                      : `sell ${sym}`}
          </button>
        )}
      </div>

      {status ? (
        <p className={`mt-3 break-words text-[12px] ${status.kind === "error" ? "text-down" : "text-ink-3"}`}>
          {status.text}
          {pending && inFlight ? (
            <>
              {" · "}
              <a href={explorer.tx(pending)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                explorer
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-ink-4">
        a direct call to the token&apos;s pons curve — the launcher is not in the path. snipe tax applies to non-exempt buys in the first minutes after launch;{" "}
        <a href={ponsTradeUrl(token)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
          the same market on pons ↗
        </a>
      </p>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-3">{k}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
