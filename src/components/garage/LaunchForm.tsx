"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs, type Address } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { ConnectButton, useMounted } from "@/components/ConnectButton";
import tree from "@/data/catalog-tree.json";
import { pairOf, type Car } from "@/data/catalog";
import { LAUNCH_CONFIG_ID, ZERO_ADDRESS } from "@/data/pairs";
import { robinhoodChain, explorer } from "@/lib/chain";
import { formatUnitsTrim, parseDecimal } from "@/lib/curvemath";
import { shortAddress } from "@/lib/format";
import { LAUNCHER_ADDRESS, launcherAbi } from "@/lib/launcher";
import { erc20Abi, factoryAbi, PONS } from "@/lib/ponsAbi";
import { site } from "@/lib/site";

export type LaunchResult = { token: Address; curve: Address; txHash: `0x${string}`; launcher: Address };

const ZERO: Address = ZERO_ADDRESS;
const URL_OK = /^(https:\/\/|ipfs:\/\/)\S+$/;

/**
 * The launch: one transaction to the launcher. Name, ticker and pair are the
 * car's and cannot be edited — they are what the Merkle proof commits to.
 * Everything else (logo, description, socials, creator tax, first buy) is
 * yours. A stock-paired car is bought with the stock token, so it needs an
 * approval first; the value sent is then Pons' launch fee only.
 */
export function LaunchForm({ car, configured, ponsLaunchFeeWei, share, onLaunched }: { car: Car; configured: boolean; ponsLaunchFeeWei: string; share: number; onLaunched: (r: LaunchResult) => void }) {
  const pair = pairOf(car);
  const stock = pair.symbol !== "ETH";
  const mounted = useMounted();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === robinhoodChain.id;
  const account = address ?? ZERO;

  const [logoMode, setLogoMode] = useState<"site" | "url">("site");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadEnabled, setUploadEnabled] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState(car.blurb);
  const [x, setX] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [amount, setAmount] = useState(stock ? "0.1" : "0.01");
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<`0x${string}` | null>(null);

  // The site's own logo route, on whatever origin serves the page — read
  // only once the client owns the tree so server and client render the same.
  const origin = mounted && typeof window !== "undefined" ? window.location.origin : site.url;
  const siteLogo = `${origin}/logo/${car.slug}.png`;
  const logo = logoMode === "site" ? siteLogo : logoUrl.trim();

  useEffect(() => {
    let alive = true;
    fetch("/api/upload")
      .then((r) => r.json())
      .then((j: { enabled: boolean }) => alive && setUploadEnabled(Boolean(j.enabled)))
      .catch(() => alive && setUploadEnabled(false));
    return () => {
      alive = false;
    };
  }, []);

  const { data: eth } = useBalance({ address, chainId: robinhoodChain.id, query: { enabled: Boolean(address) } });
  const { data: reads, refetch } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: PONS.factory, abi: factoryAbi, functionName: "maxCreatorTaxBps", chainId: robinhoodChain.id },
      { address: PONS.factory, abi: factoryAbi, functionName: "launchFee", chainId: robinhoodChain.id },
      { address: pair.address, abi: erc20Abi, functionName: "balanceOf", args: [account], chainId: robinhoodChain.id },
      { address: pair.address, abi: erc20Abi, functionName: "allowance", args: [account, LAUNCHER_ADDRESS ?? ZERO], chainId: robinhoodChain.id },
    ],
    query: { refetchInterval: 12_000 },
  });
  const maxTaxBps = reads?.[0]?.status === "success" ? Number(reads[0].result) : 1000;
  const fee = reads?.[1]?.status === "success" ? reads[1].result : BigInt(ponsLaunchFeeWei || "0");
  const pairBalance = stock && reads?.[2]?.status === "success" ? reads[2].result : 0n;
  const allowance = stock && reads?.[3]?.status === "success" ? reads[3].result : 0n;

  const buy = useMemo(() => parseDecimal(amount, pair.decimals), [amount, pair.decimals]);
  const value = stock ? fee : fee + (buy ?? 0n);
  const proof = ((tree.proofs as Record<string, string[]>)[String(car.id)] ?? []) as `0x${string}`[];
  const needsApproval = stock && buy !== null && buy > 0n && allowance < buy;
  const insufficient = !buy || buy <= 0n ? false : stock ? pairBalance < buy || (eth ? eth.value < fee : false) : eth ? eth.value < value + 200_000_000_000_000n : false;

  const { writeContractAsync, isPending } = useWriteContract();
  const inFlight = pending !== null;

  async function uploadFile(file: File) {
    setUploading(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { ok: boolean; uri?: string; error?: string };
      if (!json.ok || !json.uri) throw new Error(json.error ?? "upload failed");
      setLogoUrl(json.uri);
      setLogoMode("url");
      setNote({ kind: "info", text: `pinned · ${json.uri}` });
    } catch (e) {
      setNote({ kind: "error", text: e instanceof Error ? e.message : "upload failed" });
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!address || !LAUNCHER_ADDRESS || !buy || buy <= 0n || !publicClient) return;
    setNote(null);
    try {
      if (needsApproval) {
        const hash = await writeContractAsync({ address: pair.address, abi: erc20Abi, functionName: "approve", args: [LAUNCHER_ADDRESS, buy], chainId: robinhoodChain.id });
        setPending(hash);
        setNote({ kind: "info", text: `approval submitted · ${shortAddress(hash, 8)}` });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        setPending(null);
        if (receipt.status !== "success") {
          setNote({ kind: "error", text: "the approval reverted." });
          return;
        }
        await refetch();
        setNote({ kind: "info", text: `approved · ${shortAddress(hash, 8)} — now start your engine.` });
        return;
      }
      const hash = await writeContractAsync({
        address: LAUNCHER_ADDRESS,
        abi: launcherAbi,
        functionName: "launch",
        args: [
          BigInt(car.id),
          car.name,
          car.ticker,
          pair.address,
          proof,
          logo,
          description.trim(),
          [x.trim(), telegram.trim(), website.trim(), "", ""],
          Math.round(taxPct * 100),
          BigInt(LAUNCH_CONFIG_ID),
          buy,
          // The buy is the first trade on a curve that does not exist yet — nothing can front-run it.
          0n,
        ],
        value,
        chainId: robinhoodChain.id,
      });
      setPending(hash);
      setNote({ kind: "info", text: `launch submitted · ${shortAddress(hash, 8)}` });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setPending(null);
      if (receipt.status !== "success") {
        setNote({ kind: "error", text: "the launch reverted. the bay may have been taken a moment ago — reload the garage." });
        return;
      }
      const ev = parseEventLogs({ abi: launcherAbi, eventName: "ItemClaimed", logs: receipt.logs })[0];
      if (!ev) {
        setNote({ kind: "error", text: "confirmed, but no ItemClaimed event was found in the receipt." });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      onLaunched({ token: ev.args.token, curve: ev.args.curve, txHash: receipt.transactionHash, launcher: address });
    } catch (err) {
      setPending(null);
      setNote({ kind: "error", text: err instanceof Error ? err.message.split("\n")[0] : "transaction failed" });
    }
  }

  const canSubmit = mounted && configured && onChain && buy !== null && buy > 0n && !insufficient && !isPending && !inFlight && logo.length > 0 && (logoMode !== "url" || URL_OK.test(logo));

  const totalSharePct = share + taxPct;
  const q = pair.symbol.toLowerCase();

  return (
    <div className="card card-accent p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="display text-[26px] text-ink">launch ${car.ticker.toLowerCase()}</h3>
        <span className="mono text-[11px] text-ink-3">one transaction</span>
      </div>

      {/* The promise, in one line */}
      <div className="mt-4 rounded-2xl border border-bayside/40 bg-bayside/10 p-4">
        <div className="display text-[22px] leading-tight text-ink">
          you earn <span className="text-bayside-2">{totalSharePct.toFixed(1)}%</span> of every trade on it. forever.
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          pons takes a small fee on every buy and sell of ${car.ticker.toLowerCase()} and pays the creator&apos;s share — {share.toFixed(1)}% of the volume{taxPct > 0 ? `, plus your ${taxPct.toFixed(1)}% creator tax` : ""} — to <b className="text-ink">your wallet, in {q}</b>. nobody else can launch this car.
        </p>
        <p className="mono mt-2 text-[11px] text-ink-3">example: 1 {q} of daily volume → {(totalSharePct / 100).toFixed(4)} {q} a day to you. arithmetic, not a forecast.</p>
      </div>

      {!configured ? (
        <p className="mt-3 rounded-xl border border-line bg-floor p-3 text-[13px] text-ink-2">the launcher isn&apos;t deployed yet, so nothing can be claimed. everything below is what the launch will look like.</p>
      ) : null}

      {/* First buy — the only thing to decide */}
      <label className="mt-5 block">
        <span className="mb-2 flex items-baseline justify-between">
          <span className="label">your first buy ({q})</span>
          <span className="mono text-[11px] text-ink-3">
            {stock ? `${formatUnitsTrim(pairBalance, pair.decimals, 4)} ${q} in wallet` : eth ? `${formatUnitsTrim(eth.value, 18, 4)} eth in wallet` : "—"}
          </span>
        </span>
        <input className="field mono text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(amount && buy === null)} aria-label="first buy" />
      </label>
      <p className="mt-2 text-[12px] text-ink-3">you get the first tokens on the curve at the starting price; nobody can front-run a launch. pons&apos; launch fee is {formatUnitsTrim(fee, 18, 6)} eth; this site takes nothing.</p>

      <div className="mt-4">
        {!mounted || !isConnected || !onChain ? (
          <ConnectButton size="md" />
        ) : (
          <button type="button" className="btn btn-primary w-full !h-12 !text-[15px]" disabled={!canSubmit} onClick={submit}>
            {isPending ? "confirm in wallet…" : inFlight ? "waiting for the chain…" : insufficient ? `not enough ${stock ? q : "eth"}` : needsApproval ? `approve ${q}, then launch` : `start your engine · launch $${car.ticker.toLowerCase()}`}
          </button>
        )}
      </div>
      {note ? (
        <p className={`mt-3 break-words text-[12px] ${note.kind === "error" ? "text-down" : "text-ink-3"}`}>
          {note.text}
          {pending ? (
            <>
              {" · "}
              <a href={explorer.tx(pending)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                explorer
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <details className="group mt-5 rounded-2xl border border-line bg-floor">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] text-ink-2 [&::-webkit-details-marker]:hidden">
          customise the token (optional) — logo, description, socials, creator tax
          <span className="mono text-ink-3 transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="px-4 pb-4">
      {/* Identity — read-only */}
      <dl className="mt-1 grid grid-cols-3 gap-2 text-[12px]">
        <div className="rounded-xl border border-line bg-floor p-3">
          <dt className="label">name</dt>
          <dd className="mt-1 truncate text-ink">{car.name}</dd>
        </div>
        <div className="rounded-xl border border-line bg-floor p-3">
          <dt className="label">ticker</dt>
          <dd className="mono mt-1 text-ink">${car.ticker}</dd>
        </div>
        <div className="rounded-xl border border-line bg-floor p-3">
          <dt className="label">pair</dt>
          <dd className="mono mt-1 text-ink">{pair.symbol}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-ink-4">name, ticker and pair are the car&apos;s identity — they&apos;re what the catalog proof commits to and can&apos;t be changed.</p>

      {/* Logo */}
      <div className="mt-5">
        <span className="label">logo</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="pill pill-sm" aria-pressed={logoMode === "site"} onClick={() => setLogoMode("site")}>
            the car&apos;s own
          </button>
          <button type="button" className="pill pill-sm" aria-pressed={logoMode === "url"} onClick={() => setLogoMode("url")}>
            a url
          </button>
          {uploadEnabled ? (
            <label className="pill pill-sm cursor-pointer">
              {uploading ? "pinning…" : "upload"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            </label>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-3">
          {/* the preview waits for the client: the site's own logo route lives on this page's origin */}
          {mounted ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoMode === "site" ? siteLogo : logo || siteLogo} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-2xl border border-line bg-floor object-cover" />
          ) : (
            <div aria-hidden className="h-16 w-16 shrink-0 rounded-2xl border border-line bg-floor" />
          )}
          {logoMode === "site" ? (
            <p className="text-[12px] text-ink-3">
              generated from the car&apos;s profile, served by this site at <span className="mono">/logo/{car.slug}.png</span>
              {uploadEnabled === false ? " · uploads aren't configured here, so it's this or a url" : ""}
            </p>
          ) : (
            <input className="field" placeholder="https://… or ipfs://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} aria-invalid={Boolean(logoUrl) && !URL_OK.test(logoUrl.trim())} aria-label="logo url" />
          )}
        </div>
      </div>

      {/* Description & socials */}
      <label className="mt-5 block">
        <span className="label">description</span>
        <textarea className="field mt-2" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input className="field" placeholder="x.com/…" value={x} onChange={(e) => setX(e.target.value)} aria-label="x" />
        <input className="field" placeholder="t.me/…" value={telegram} onChange={(e) => setTelegram(e.target.value)} aria-label="telegram" />
        <input className="field" placeholder="website" value={website} onChange={(e) => setWebsite(e.target.value)} aria-label="website" />
      </div>

      {/* Creator tax */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="label">creator tax</span>
          <span className="mono text-[13px] text-ink">{taxPct.toFixed(1)}%</span>
        </div>
        <input type="range" min={0} max={maxTaxBps / 100} step={0.5} value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} className="mt-2 w-full accent-bayside" aria-label="creator tax" />
        <p className="mt-1 text-[11px] text-ink-4">on top of pons&apos; 1% trade fee, paid to your wallet. the factory allows up to {(maxTaxBps / 100).toFixed(0)}%.</p>
      </div>

        </div>
      </details>

      <dl className="mt-4 space-y-1.5 text-[12px]">
        <div className="flex justify-between">
          <dt className="text-ink-3">sent with the transaction</dt>
          <dd className="mono text-ink">
            {formatUnitsTrim(value, 18, 6)} eth{stock && buy ? ` + ${formatUnitsTrim(buy, pair.decimals, 6)} ${q}` : ""}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">of which pons&apos; launch fee</dt>
          <dd className="mono text-ink-2">{formatUnitsTrim(fee, 18, 6)} eth</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">platform fee</dt>
          <dd className="mono text-ink-2">none</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
        your wallet becomes the token&apos;s creator-fee recipient and receives the first buy. the launch goes through pons&apos; own forwarder; the launcher stores the claim and takes nothing.
      </p>
    </div>
  );
}
