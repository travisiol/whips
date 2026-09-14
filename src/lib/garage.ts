import { parseAbiItem, type Address } from "viem";
import { CARS } from "@/data/catalog";
import { PAIRS, ZERO_ADDRESS, type PairSymbol } from "@/data/pairs";
import { chainClient } from "@/lib/chainClient";
import { LAUNCHER_ADDRESS, LAUNCHER_DEPLOY_BLOCK, launcherAbi } from "@/lib/launcher";
import { curveAbi, escrowAbi, factoryAbi, PONS } from "@/lib/ponsAbi";

/**
 * Everything the garage shows is read from Robinhood Chain here, on the
 * server, and cached for 15 seconds: the launcher's claimed ids, then its
 * `claims` for those in one multicall, the curve views for each, the fee
 * escrow for the launcher's pending creator fees, and the ItemClaimed logs
 * for launch time and transaction. No indexer, no Pons API.
 */
export type Market = {
  /** Quote per token, in the pair's units. */
  price: number;
  marketCap: number;
  raised: number;
  threshold: number;
  progressPct: number;
  graduated: boolean;
  launchSupply: number;
  feeBps: number;
  creatorTaxBps: number;
  protocolFeeShareBps: number;
  /** Reserves as decimal strings of base units, for exact client-side quotes. */
  quoteReserve: string;
  tokenReserve: string;
  quoteFeeBalance: string;
};

export type Claimed = {
  itemId: number;
  token: Address;
  curve: Address;
  launcher: Address;
  pair: PairSymbol;
  pairAddress: Address;
  launchBlock: number;
  launchedAt: number;
  txHash: string | null;
  market: Market;
  fees: {
    /** Creator fees sitting in the Pons escrow for the launcher, base units. */
    pendingWei: string;
    /** The creator's share of fees still on the curve, waiting for Pons' sweep, base units. */
    accruingWei: string;
  };
};

export type GarageState = {
  ok: boolean;
  configured: boolean;
  launcher: Address | null;
  chainId: number;
  blockNumber: number;
  ponsLaunchFeeWei: string;
  /** Pons' trade fee and the protocol's share of it, read from a live curve. */
  ponsFeeBps: number;
  ponsProtocolShareBps: number;
  claims: Claimed[];
  readAt: number;
  error?: string;
};

/** The creator's cut of every trade, in percent of volume: fee × (1 − protocol share). */
export function creatorSharePct(state: Pick<GarageState, "ponsFeeBps" | "ponsProtocolShareBps"> | undefined): number {
  const fee = state?.ponsFeeBps ?? 100;
  const protocol = state?.ponsProtocolShareBps ?? 3000;
  return (fee / 100) * (1 - protocol / 10_000);
}

const TTL_MS = 15_000;
const itemClaimedEvent = parseAbiItem(
  "event ItemClaimed(uint256 indexed itemId, address indexed token, address curve, address indexed launcher, address pairToken, string symbol)",
);
const curveBuyEvent = parseAbiItem("event CurveBuy(address indexed sender, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 snipeTax)");
const curveSellEvent = parseAbiItem("event CurveSell(address indexed sender, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 snipeTax)");
const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const tokenLaunchedEvent = parseAbiItem("event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 configId, uint256 threshold)");

type LaunchMeta = { block: number; at: number; tx: string };
let protocolFees: { at: number; feeBps: number; protocolShareBps: number } | null = null;

/**
 * Pons' fee parameters, read off a live curve (the most recent launch on
 * the factory) and cached for an hour. They are what every "you earn x%"
 * on the site is computed from.
 */
async function readProtocolFees(head: bigint): Promise<{ feeBps: number; protocolShareBps: number }> {
  if (protocolFees && Date.now() - protocolFees.at < 3_600_000) return protocolFees;
  const client = chainClient();
  const logs = await client.getLogs({ address: PONS.factory, event: tokenLaunchedEvent, fromBlock: head > 5_000n ? head - 5_000n : 0n, toBlock: head });
  const curve = logs.length ? (logs[logs.length - 1].args.curve as Address | undefined) : undefined;
  if (!curve) throw new Error("no recent launch to read fees from");
  const [fee, share] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: curve, abi: curveAbi, functionName: "feeBps" },
      { address: curve, abi: curveAbi, functionName: "protocolFeeShareBps" },
    ],
  });
  protocolFees = { at: Date.now(), feeBps: Number(fee), protocolShareBps: Number(share) };
  return protocolFees;
}
const launchMeta = new Map<number, LaunchMeta>();
let scannedTo = 0n;
let cache: { at: number; state: GarageState } | null = null;
let inflight: Promise<GarageState> | null = null;

function pairFor(address: string): PairSymbol {
  const a = address.toLowerCase();
  for (const p of Object.values(PAIRS)) if (p.address.toLowerCase() === a) return p.symbol;
  return "ETH";
}

/** Scans ItemClaimed logs forward from the last scanned block, in 100k-block windows. */
async function scanClaimLogs(head: bigint) {
  if (!LAUNCHER_ADDRESS) return;
  const client = chainClient();
  let from = scannedTo > 0n ? scannedTo + 1n : LAUNCHER_DEPLOY_BLOCK > 0n ? LAUNCHER_DEPLOY_BLOCK : head > 400_000n ? head - 400_000n : 0n;
  while (from <= head) {
    const to = from + 100_000n > head ? head : from + 100_000n;
    const logs = await client.getLogs({ address: LAUNCHER_ADDRESS, event: itemClaimedEvent, fromBlock: from, toBlock: to });
    for (const log of logs) {
      const id = Number(log.args.itemId);
      if (!launchMeta.has(id) && log.blockNumber !== null && log.transactionHash) {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        launchMeta.set(id, { block: Number(log.blockNumber), at: Number(block.timestamp), tx: log.transactionHash });
      }
    }
    scannedTo = to;
    from = to + 1n;
  }
}

async function read(): Promise<GarageState> {
  const client = chainClient();
  const chainId = client.chain?.id ?? 0;
  const readAt = Math.floor(Date.now() / 1000);
  const head = await client.getBlockNumber();
  const fees = await readProtocolFees(head).catch(() => ({ feeBps: 100, protocolShareBps: 3000 }));
  const base = { chainId, blockNumber: Number(head), ponsFeeBps: fees.feeBps, ponsProtocolShareBps: fees.protocolShareBps, readAt };
  if (!LAUNCHER_ADDRESS) {
    const fee = await client.readContract({ address: PONS.factory, abi: factoryAbi, functionName: "launchFee" }).catch(() => 0n);
    return { ok: true, configured: false, launcher: null, ...base, ponsLaunchFeeWei: fee.toString(), claims: [] };
  }

  const launcher = LAUNCHER_ADDRESS;
  // Which bays are taken comes from the launcher's own claim list (one call,
  // limit 0 = all), then one multicall for those claims — O(claims), not
  // O(catalog), and never a read of an empty bay.
  const [fee, ids] = await Promise.all([
    client.readContract({ address: PONS.factory, abi: factoryAbi, functionName: "launchFee" }).catch(() => 500_000_000_000_000n),
    client.readContract({ address: launcher, abi: launcherAbi, functionName: "claimedIds", args: [0n, 0n] }),
  ]);
  const ponsLaunchFeeWei = fee.toString();
  const known = ids.map(Number).filter((id) => CARS.some((c) => c.id === id));
  const claimResults = known.length
    ? await client.multicall({
        allowFailure: true,
        contracts: known.map((id) => ({ address: launcher, abi: launcherAbi, functionName: "claims", args: [BigInt(id)] }) as const),
      })
    : [];

  const claimed: { itemId: number; token: Address; curve: Address; launcher: Address }[] = [];
  claimResults.forEach((r, i) => {
    if (r.status !== "success") return;
    const [token, curve, who] = r.result;
    if (token && token !== ZERO_ADDRESS) claimed.push({ itemId: known[i], token, curve, launcher: who });
  });

  if (claimed.length === 0) {
    return { ok: true, configured: true, launcher: LAUNCHER_ADDRESS, ...base, ponsLaunchFeeWei, claims: [] };
  }

  // Launch metadata (block, time, tx) from the logs — scanned incrementally.
  try {
    await scanClaimLogs(head);
  } catch {
    /* logs are decoration; the claims themselves came from state */
  }

  const views = ["getReserves", "realQuoteReserve", "graduationThreshold", "graduated", "launchSupply", "feeBps", "creatorTaxBps", "quoteFeeBalance", "protocolFeeShareBps", "pairToken"] as const;
  const curveCalls = claimed.flatMap((c) => views.map((fn) => ({ address: c.curve, abi: curveAbi, functionName: fn })));
  const curveResults = await client.multicall({ allowFailure: true, contracts: curveCalls });

  const claims: Claimed[] = claimed.map((c, i) => {
    const at = (k: number) => curveResults[i * views.length + k];
    const val = <T>(k: number, fallback: T): T => (at(k).status === "success" ? (at(k).result as T) : fallback);
    const [quoteReserve, tokenReserve] = val<readonly [bigint, bigint]>(0, [0n, 0n]);
    const raised = val<bigint>(1, 0n);
    const threshold = val<bigint>(2, 0n);
    const graduated = val<boolean>(3, false);
    const launchSupply = val<bigint>(4, 0n);
    const feeBps = Number(val<bigint>(5, 100n));
    const creatorTaxBps = Number(val<bigint>(6, 0n));
    const quoteFeeBalance = val<bigint>(7, 0n);
    const protocolFeeShareBps = Number(val<bigint>(8, 3000n));
    const pairAddress = val<Address>(9, ZERO_ADDRESS);
    const pair = pairFor(pairAddress);
    const decimals = PAIRS[pair].decimals;
    const price = tokenReserve > 0n ? Number(quoteReserve) / 10 ** decimals / (Number(tokenReserve) / 1e18) : 0;
    const supply = Number(launchSupply) / 1e18;
    const raisedF = Number(raised) / 10 ** decimals;
    const thresholdF = Number(threshold) / 10 ** decimals;
    const meta = launchMeta.get(c.itemId);
    const creatorShare = quoteFeeBalance - (quoteFeeBalance * BigInt(protocolFeeShareBps)) / 10_000n;
    return {
      itemId: c.itemId,
      token: c.token,
      curve: c.curve,
      launcher: c.launcher,
      pair,
      pairAddress,
      launchBlock: meta?.block ?? 0,
      launchedAt: meta?.at ?? 0,
      txHash: meta?.tx ?? null,
      market: {
        price,
        marketCap: price * supply,
        raised: raisedF,
        threshold: thresholdF,
        progressPct: thresholdF > 0 ? Math.min(100, (raisedF / thresholdF) * 100) : 0,
        graduated,
        launchSupply: supply,
        feeBps,
        creatorTaxBps,
        protocolFeeShareBps,
        quoteReserve: quoteReserve.toString(),
        tokenReserve: tokenReserve.toString(),
        quoteFeeBalance: quoteFeeBalance.toString(),
      },
      fees: { pendingWei: "0", accruingWei: creatorShare.toString() },
    };
  });

  // Pending creator fees in the Pons escrow, per launcher wallet and pair.
  const escrowCalls = claims.map((c) =>
    c.pair === "ETH"
      ? { address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "balanceOf" as const, args: [c.launcher] as const }
      : { address: PONS.feeEscrow as Address, abi: escrowAbi, functionName: "balanceOfToken" as const, args: [c.pairAddress, c.launcher] as const },
  );
  try {
    const escrowResults = await client.multicall({ allowFailure: true, contracts: escrowCalls });
    escrowResults.forEach((r, i) => {
      if (r.status === "success") claims[i].fees.pendingWei = (r.result as bigint).toString();
    });
  } catch {
    /* escrow view unavailable on this RPC — pending stays 0 and is labelled as unread */
  }

  return { ok: true, configured: true, launcher: LAUNCHER_ADDRESS, ...base, ponsLaunchFeeWei, claims };
}

/**
 * The garage for a server render: whatever is cached, or a fresh read if it
 * lands within a couple of seconds — otherwise undefined and the client
 * fetches it, while the read keeps going and fills the cache for the next
 * request. A slow RPC must never hold the page.
 */
export async function readGarageQuick(budgetMs = 2500): Promise<GarageState | undefined> {
  const read = readGarage();
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), budgetMs));
  const state = await Promise.race([read, timeout]);
  return state && state.ok ? state : undefined;
}

/** The garage, at most 15 seconds old. Concurrent callers share one read. */
export async function readGarage(): Promise<GarageState> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.state;
  if (inflight) return inflight;
  inflight = read()
    .then((state) => {
      cache = { at: Date.now(), state };
      return state;
    })
    .catch((e: unknown) => {
      const state: GarageState = {
        ok: false,
        configured: LAUNCHER_ADDRESS !== null,
        launcher: LAUNCHER_ADDRESS,
        chainId: 0,
        blockNumber: 0,
        ponsLaunchFeeWei: "0",
        ponsFeeBps: protocolFees?.feeBps ?? 100,
        ponsProtocolShareBps: protocolFees?.protocolShareBps ?? 3000,
        claims: cache?.state.claims ?? [],
        readAt: Math.floor(Date.now() / 1000),
        error: e instanceof Error ? e.message.split("\n")[0] : "chain read failed",
      };
      return state;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// ── Per-car detail: trades and holders from logs ──────────────────────

export type Trade = {
  side: "buy" | "sell";
  account: Address;
  tokenAmount: string;
  quoteAmount: string;
  blockNumber: number;
  txHash: string;
  timestamp: number;
};

export type Holder = { address: Address; balance: string; pct: number };

/** What the token contract itself says — the identity the launch wrote on chain. */
export type TokenMeta = { name: string; symbol: string; logo: string; description: string; socials: string[]; deployer: Address };

export type CarDetail = {
  ok: boolean;
  itemId: number;
  claim: Claimed | null;
  meta: TokenMeta | null;
  trades: Trade[];
  holders: { count: number; top: Holder[]; sampled: boolean };
  readAt: number;
  error?: string;
};

const tokenMetaAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "logo", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "deployer", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "socials", stateMutability: "view", inputs: [], outputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }] },
] as const;

/** Reads the token's own metadata views (Pons tokens store them on chain). */
async function readTokenMeta(token: Address): Promise<TokenMeta | null> {
  const client = chainClient();
  const r = await client.multicall({
    allowFailure: true,
    contracts: [
      { address: token, abi: tokenMetaAbi, functionName: "name" },
      { address: token, abi: tokenMetaAbi, functionName: "symbol" },
      { address: token, abi: tokenMetaAbi, functionName: "logo" },
      { address: token, abi: tokenMetaAbi, functionName: "description" },
      { address: token, abi: tokenMetaAbi, functionName: "deployer" },
      { address: token, abi: tokenMetaAbi, functionName: "socials" },
    ],
  });
  if (r[0].status !== "success" || r[1].status !== "success") return null;
  const socials = r[5].status === "success" ? [...(r[5].result as readonly string[])] : [];
  return {
    name: r[0].result as string,
    symbol: r[1].result as string,
    logo: r[2].status === "success" ? (r[2].result as string) : "",
    description: r[3].status === "success" ? (r[3].result as string) : "",
    deployer: r[4].status === "success" ? (r[4].result as Address) : ZERO_ADDRESS,
    socials,
  };
}

const detailCache = new Map<number, { at: number; detail: CarDetail }>();
const blockTimes = new Map<bigint, number>();

async function blockTime(n: bigint): Promise<number> {
  const hit = blockTimes.get(n);
  if (hit) return hit;
  const b = await chainClient().getBlock({ blockNumber: n });
  blockTimes.set(n, Number(b.timestamp));
  return Number(b.timestamp);
}

export async function readCar(itemId: number): Promise<CarDetail> {
  const hit = detailCache.get(itemId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.detail;
  const garage = await readGarage();
  const claim = garage.claims.find((c) => c.itemId === itemId) ?? null;
  const readAt = Math.floor(Date.now() / 1000);
  if (!claim) {
    const detail: CarDetail = { ok: true, itemId, claim: null, meta: null, trades: [], holders: { count: 0, top: [], sampled: false }, readAt };
    return detail;
  }
  const client = chainClient();
  const meta = await readTokenMeta(claim.token).catch(() => null);
  try {
    const head = BigInt(garage.blockNumber);
    const from = claim.launchBlock > 0 ? BigInt(claim.launchBlock) : head > 400_000n ? head - 400_000n : 0n;
    const [buys, sells, transfers] = await Promise.all([
      client.getLogs({ address: claim.curve, event: curveBuyEvent, fromBlock: from, toBlock: head }),
      client.getLogs({ address: claim.curve, event: curveSellEvent, fromBlock: from, toBlock: head }),
      client.getLogs({ address: claim.token, event: transferEvent, fromBlock: from, toBlock: head }),
    ]);
    const raw = [
      ...buys.map((l) => ({ side: "buy" as const, account: l.args.recipient as Address, tokenAmount: (l.args.tokensOut as bigint).toString(), quoteAmount: (l.args.quoteIn as bigint).toString(), blockNumber: Number(l.blockNumber), txHash: l.transactionHash as string })),
      ...sells.map((l) => ({ side: "sell" as const, account: l.args.sender as Address, tokenAmount: (l.args.tokensIn as bigint).toString(), quoteAmount: (l.args.quoteOut as bigint).toString(), blockNumber: Number(l.blockNumber), txHash: l.transactionHash as string })),
    ].sort((a, b) => b.blockNumber - a.blockNumber);
    const recent = raw.slice(0, 40);
    const trades: Trade[] = [];
    for (const t of recent) trades.push({ ...t, timestamp: await blockTime(BigInt(t.blockNumber)) });

    // Holders from Transfer logs: net balances, curve excluded.
    const balances = new Map<string, bigint>();
    for (const l of transfers) {
      const from_ = (l.args.from as string).toLowerCase();
      const to_ = (l.args.to as string).toLowerCase();
      const v = l.args.value as bigint;
      if (from_ !== ZERO_ADDRESS) balances.set(from_, (balances.get(from_) ?? 0n) - v);
      balances.set(to_, (balances.get(to_) ?? 0n) + v);
    }
    balances.delete(claim.curve.toLowerCase());
    balances.delete(ZERO_ADDRESS);
    const supply = BigInt(Math.round(claim.market.launchSupply)) * 10n ** 18n;
    const holdersAll = [...balances.entries()].filter(([, b]) => b > 0n).sort((a, b) => (a[1] > b[1] ? -1 : 1));
    const top: Holder[] = holdersAll.slice(0, 10).map(([address, balance]) => ({ address: address as Address, balance: balance.toString(), pct: supply > 0n ? Number((balance * 10_000n) / supply) / 100 : 0 }));
    const detail: CarDetail = { ok: true, itemId, claim, meta, trades, holders: { count: holdersAll.length, top, sampled: claim.launchBlock === 0 }, readAt };
    detailCache.set(itemId, { at: Date.now(), detail });
    return detail;
  } catch (e) {
    return { ok: false, itemId, claim, meta, trades: [], holders: { count: 0, top: [], sampled: false }, readAt, error: e instanceof Error ? e.message.split("\n")[0] : "chain read failed" };
  }
}
