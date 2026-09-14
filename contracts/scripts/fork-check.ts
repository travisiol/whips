import { ethers, network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { CARS, pairOf } from "../../src/data/catalog";
import { PAIRS } from "../../src/data/pairs";

/**
 * Exercises WhipsLauncher against the REAL Pons V2 factory on a fork of
 * Robinhood Chain. Nothing is broadcast.
 *
 *   FORK_URL=https://rpc.mainnet.chain.robinhood.com npm run fork:check
 *
 * In order: deploy the launcher with the real catalog root; claim the F40
 * (ETH pair) through the forwarder in one transaction; every rule that must
 * revert (double claim, wrong proof, wrong pair, zero buy, wrong value);
 * a stock-paired claim (Cybertruck → TSLA) paid in real TSLA tokens through
 * approve → launcher → forwarder; whether the token address depends on the
 * salt alone (CREATE2) by launching the same item from a second launcher;
 * and a buy + sell on the new curve checked against the local quote math.
 */
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const PONS_FORWARDER = "0xe33e9e479df8802cb0866d5d05258bec4cf62948";
const ZERO = ethers.ZeroAddress;

const CURVE_ABI = [
  "function getReserves() view returns (uint256,uint256)",
  "function realQuoteReserve() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function deployer() view returns (address)",
  "function pairToken() view returns (address)",
  "function token() view returns (address)",
  "function launchSupply() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function buybackEnabled() view returns (bool)",
  "function snipeTaxExempt(address) view returns (bool)",
  "function currentSnipeTaxBps(address) view returns (uint256)",
  "function quoteFeeBalance() view returns (uint256)",
  "function buy(uint256,uint256,address) payable returns (uint256)",
  "function sell(uint256,uint256,address) returns (uint256)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const FACTORY_ABI = [
  "function launchFee() view returns (uint256)",
  "function launchForwarder() view returns (address)",
  "function previewLaunchEconomics(uint256,address) view returns (bytes32)",
  "function launchToken((string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32),uint256,address,address[]) payable returns (address,address)",
];

const BPS = 10_000n;
const fmt = (v: bigint, d = 18) => ethers.formatUnits(v, d);

function buildTree() {
  const values = CARS.map((c) => [BigInt(c.id), c.name, c.ticker, pairOf(c).address] as [bigint, string, string, string]);
  const tree = StandardMerkleTree.of(values, ["uint256", "string", "string", "address"]);
  const proofFor = (id: number) => {
    for (const [i, v] of tree.entries()) if (Number(v[0]) === id) return tree.getProof(i);
    throw new Error(`no leaf for ${id}`);
  };
  return { root: tree.root, proofFor };
}

function parseEvent(contract: { interface: { parseLog: (l: { topics: string[]; data: string }) => unknown } }, logs: readonly { topics: readonly string[]; data: string }[], name: string) {
  return logs
    .map((l) => {
      try {
        return contract.interface.parseLog({ topics: [...l.topics], data: l.data }) as { name: string; args: unknown[] } | null;
      } catch {
        return null;
      }
    })
    .find((p) => p?.name === name);
}

async function expectRevert(p: Promise<unknown>, label: string, needle: string) {
  try {
    await p;
    throw new Error(`${label}: expected revert (${needle})`);
  } catch (e) {
    const msg = (e as Error).message;
    if (!msg.includes(needle)) throw new Error(`${label}: reverted with something else: ${msg.slice(0, 160)}`);
    console.log(`  ✓ ${label} → ${needle}`);
  }
}

/** Finds a wallet holding at least `min` of `token` in recent Transfer logs, impersonates it and sends `amount` to `to`. */
async function borrow(token: string, to: string, amount: bigint, min: bigint) {
  const erc20 = new ethers.Contract(token, ERC20_ABI, ethers.provider);
  const head = await ethers.provider.getBlockNumber();
  // The public RPC caps a query at 10k logs; a busy stock token fills that fast, so shrink the window until it fits.
  let logs: Awaited<ReturnType<typeof erc20.queryFilter>> = [];
  for (const span of [4_000, 1_500, 500, 150]) {
    try {
      logs = await erc20.queryFilter(erc20.filters.Transfer(), head - span, head);
      break;
    } catch {
      /* too many logs — narrower window */
    }
  }
  const seen = new Set<string>();
  for (let i = logs.length - 1; i >= 0; i--) {
    const to_ = (logs[i] as { args: { to: string } }).args.to;
    if (seen.has(to_) || to_ === ZERO) continue;
    seen.add(to_);
    const bal = (await erc20.balanceOf(to_)) as bigint;
    if (bal < min) continue;
    await network.provider.send("hardhat_impersonateAccount", [to_]);
    await network.provider.send("hardhat_setBalance", [to_, "0x56BC75E2D63100000"]);
    const signer = await ethers.getSigner(to_);
    await (await erc20.connect(signer).getFunction("transfer")(to, amount)).wait();
    await network.provider.send("hardhat_stopImpersonatingAccount", [to_]);
    return { from: to_, had: bal };
  }
  throw new Error(`no holder of ${token} with ≥ ${fmt(min)} found in the last 40k blocks`);
}

async function main() {
  const [deployer, creator, stranger, other, eoaA, eoaB] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`network ${network.name} chainId ${chainId} block ${await ethers.provider.getBlockNumber()}`);
  if ((await ethers.provider.getCode(PONS_FACTORY)) === "0x") throw new Error("Not a Robinhood Chain fork: no factory code at " + PONS_FACTORY);

  const factory = new ethers.Contract(PONS_FACTORY, FACTORY_ABI, ethers.provider);
  const { root, proofFor } = buildTree();
  console.log("catalogRoot", root);

  // ── 0. Deploy ──────────────────────────────────────────────────────────
  const launcher = await (await ethers.getContractFactory("WhipsLauncher")).deploy(PONS_FACTORY, root);
  await launcher.waitForDeployment();
  const launcherAddr = await launcher.getAddress();
  const fee = (await launcher.ponsLaunchFee()) as bigint;
  console.log("launcher", launcherAddr);
  console.log("forwarder (from factory)", await launcher.forwarder(), "== known", (await launcher.forwarder()).toLowerCase() === PONS_FORWARDER);
  console.log("ponsLaunchFee", fmt(fee), "ETH");
  if ((await launcher.forwarder()).toLowerCase() !== PONS_FORWARDER) throw new Error("forwarder mismatch");

  const f40 = CARS.find((c) => c.ticker === "F40")!;
  const cyber = CARS.find((c) => c.ticker === "CYBERTRUCK")!;
  const socials = ["", "", "https://whips.example", "", ""] as [string, string, string, string, string];

  // ── 1. Claim the F40 on the native curve ───────────────────────────────
  const buy = ethers.parseEther("0.02");
  const tx = await launcher
    .connect(creator)
    .launch(f40.id, f40.name, f40.ticker, ZERO, proofFor(f40.id), "https://whips.example/logo/f40.png", f40.blurb, socials, 0, 0, buy, 0, { value: fee + buy });
  const receipt = await tx.wait();
  const claimed = parseEvent(launcher, receipt!.logs, "ItemClaimed");
  if (!claimed) throw new Error("no ItemClaimed event");
  const [itemId, token, curve, who, pairToken, symbol] = claimed.args as [bigint, string, string, string, string, string];
  console.log(`\n[1] launch $${symbol} (item ${itemId}) via forwarder: gas ${receipt?.gasUsed}`);
  console.log("  token", token, "\n  curve", curve, "\n  launcher", who, "pair", pairToken);
  const erc20 = new ethers.Contract(token, ERC20_ABI, ethers.provider);
  const curveC = new ethers.Contract(curve, CURVE_ABI, ethers.provider);
  const got = (await erc20.balanceOf(creator.address)) as bigint;
  console.log("  on-chain name/symbol:", await erc20.name(), "/", await erc20.symbol());
  console.log("  creator received", fmt(got), "tokens for", fmt(buy), "ETH");
  console.log("  curve.deployer() (fee recipient) == creator:", (await curveC.deployer()) === creator.address);
  console.log("  curve.pairToken():", await curveC.pairToken(), "| buybackEnabled:", await curveC.buybackEnabled(), "| creatorTaxBps:", (await curveC.creatorTaxBps()).toString());
  console.log("  snipe-tax exempt — creator:", await curveC.snipeTaxExempt(creator.address), "| launcher contract:", await curveC.snipeTaxExempt(launcherAddr));
  console.log("  reserves", (await curveC.getReserves()).map((x: bigint) => fmt(x)).join(" / "), "realQuote", fmt(await curveC.realQuoteReserve()), "threshold", fmt(await curveC.graduationThreshold()));
  const c1 = await launcher.claims(f40.id);
  if (c1.token !== token || c1.curve !== curve || c1.launcher !== creator.address) throw new Error("claims() mismatch");
  if (got === 0n) throw new Error("first buy not delivered");
  if ((await curveC.deployer()) !== creator.address) throw new Error("fee recipient is not the launcher wallet");
  console.log("  claims(1) ✓  claimCount", (await launcher.claimCount()).toString(), "isClaimed(1)", await launcher.isClaimed(f40.id));

  // Local quote check: constant product on (quote incl. phantom, tokens), fee off the input.
  {
    const [q0, t0] = (await curveC.getReserves()) as [bigint, bigint];
    const spend = ethers.parseEther("0.05");
    const feeBps = (await curveC.feeBps()) as bigint;
    const net = spend - (spend * feeBps) / BPS;
    const expected = (t0 * net) / (q0 + net);
    const before = (await erc20.balanceOf(stranger.address)) as bigint;
    await (await curveC.connect(stranger).getFunction("buy")(spend, 0, stranger.address, { value: spend })).wait();
    const after = (await erc20.balanceOf(stranger.address)) as bigint;
    const snipe = (await curveC.currentSnipeTaxBps(stranger.address)) as bigint;
    console.log(`  stranger buy 0.05 ETH → ${fmt(after - before)} (local quote ${fmt(expected)}, snipe tax now ${snipe} bps${snipe > 0n ? " — differs by the tax" : ""})`);
    const half = (after - before) / 2n;
    await (await erc20.connect(stranger).getFunction("approve")(curve, half)).wait();
    const [q1, t1] = (await curveC.getReserves()) as [bigint, bigint];
    const gross = (q1 * half) / (t1 + half);
    const expectedOut = gross - (gross * feeBps) / BPS;
    const ethBefore = await ethers.provider.getBalance(stranger.address);
    const sellTx = await curveC.connect(stranger).getFunction("sell")(half, 0, stranger.address);
    const sellR = await sellTx.wait();
    const ethAfter = await ethers.provider.getBalance(stranger.address);
    const delta = ethAfter - ethBefore + sellR!.gasUsed * sellR!.gasPrice;
    console.log(`  stranger sell half → ${fmt(delta)} ETH (local quote ${fmt(expectedOut)}) ${delta === expectedOut ? "exact" : "≠"}`);
    console.log("  quoteFeeBalance on curve", fmt(await curveC.quoteFeeBalance()));
  }

  // ── 2. Rules that must revert ──────────────────────────────────────────
  console.log("\n[2] reverts");
  await expectRevert(
    launcher.connect(other).launch.staticCall(f40.id, f40.name, f40.ticker, ZERO, proofFor(f40.id), "", "", socials, 0, 0, buy, 0, { value: fee + buy }),
    "double claim",
    "AlreadyClaimed",
  );
  const mcf1 = CARS.find((c) => c.ticker === "MCF1")!;
  await expectRevert(
    launcher.connect(other).launch.staticCall(mcf1.id, mcf1.name, mcf1.ticker, ZERO, proofFor(f40.id), "", "", socials, 0, 0, buy, 0, { value: fee + buy }),
    "someone else's proof",
    "InvalidProof",
  );
  await expectRevert(
    launcher.connect(other).launch.staticCall(mcf1.id, "McLaren F2", mcf1.ticker, ZERO, proofFor(mcf1.id), "", "", socials, 0, 0, buy, 0, { value: fee + buy }),
    "wrong name",
    "InvalidProof",
  );
  await expectRevert(
    launcher.connect(other).launch.staticCall(mcf1.id, mcf1.name, mcf1.ticker, PAIRS.TSLA.address, proofFor(mcf1.id), "", "", socials, 0, 0, buy, 0, { value: fee }),
    "wrong pair (ETH car as TSLA)",
    "InvalidProof",
  );
  await expectRevert(
    launcher.connect(other).launch.staticCall(mcf1.id, mcf1.name, mcf1.ticker, ZERO, proofFor(mcf1.id), "", "", socials, 0, 0, 0, 0, { value: fee }),
    "zero buy",
    "ZeroAmount",
  );
  await expectRevert(
    launcher.connect(other).launch.staticCall(mcf1.id, mcf1.name, mcf1.ticker, ZERO, proofFor(mcf1.id), "", "", socials, 0, 0, buy, 0, { value: fee }),
    "value without the buy",
    "NativeValueMismatch",
  );

  // ── 3. Stock-paired claim: Cybertruck → TSLA, paid in TSLA ─────────────
  console.log("\n[3] stock-paired launch (TSLA)");
  const tsla = new ethers.Contract(PAIRS.TSLA.address, ERC20_ABI, ethers.provider);
  console.log("  pair token", PAIRS.TSLA.address, await tsla.name(), "/", await tsla.symbol());
  const tslaBuy = ethers.parseEther("0.25");
  const lender = await borrow(PAIRS.TSLA.address, creator.address, tslaBuy, tslaBuy);
  console.log("  borrowed", fmt(tslaBuy), "TSLA from", lender.from, "(held", fmt(lender.had) + ")");
  await (await tsla.connect(creator).getFunction("approve")(launcherAddr, tslaBuy)).wait();
  const econ = await factory.previewLaunchEconomics(0, PAIRS.TSLA.address);
  console.log("  previewLaunchEconomics(0, TSLA)", econ, "≠ ETH:", econ !== (await factory.previewLaunchEconomics(0, ZERO)));
  const tx3 = await launcher
    .connect(creator)
    .launch(cyber.id, cyber.name, cyber.ticker, PAIRS.TSLA.address, proofFor(cyber.id), "https://whips.example/logo/cybertruck.png", cyber.blurb, socials, 100, 0, tslaBuy, 0, { value: fee });
  const r3 = await tx3.wait();
  const claimed3 = parseEvent(launcher, r3!.logs, "ItemClaimed");
  const [, token3, curve3, , pair3, symbol3] = claimed3!.args as [bigint, string, string, string, string, string];
  const erc3 = new ethers.Contract(token3, ERC20_ABI, ethers.provider);
  const curve3C = new ethers.Contract(curve3, CURVE_ABI, ethers.provider);
  console.log(`  launched $${symbol3}: gas ${r3?.gasUsed}, token ${token3}, curve ${curve3}`);
  console.log("  event pair", pair3, "| curve.pairToken()", await curve3C.pairToken(), "== TSLA:", (await curve3C.pairToken()).toLowerCase() === PAIRS.TSLA.address.toLowerCase());
  console.log("  creator received", fmt(await erc3.balanceOf(creator.address)), "tokens for", fmt(tslaBuy), "TSLA | creatorTaxBps", (await curve3C.creatorTaxBps()).toString());
  console.log("  TSLA left on launcher:", fmt(await tsla.balanceOf(launcherAddr)), "| threshold", fmt(await curve3C.graduationThreshold()), "TSLA | realQuote", fmt(await curve3C.realQuoteReserve()));
  if ((await tsla.balanceOf(launcherAddr)) !== 0n) throw new Error("launcher kept pair tokens");
  if ((await curve3C.pairToken()).toLowerCase() !== PAIRS.TSLA.address.toLowerCase()) throw new Error("curve not TSLA-paired");

  // ── 4. Is the token address a function of the salt alone? ──────────────
  console.log("\n[4] CREATE2 determinism");
  const launcher2 = await (await ethers.getContractFactory("WhipsLauncher")).deploy(PONS_FACTORY, root);
  await launcher2.waitForDeployment();
  try {
    await launcher2.connect(other).launch.staticCall(f40.id, f40.name, f40.ticker, ZERO, proofFor(f40.id), "", "", socials, 0, 0, buy, 0, { value: fee + buy });
    const tx4 = await launcher2.connect(other).launch(f40.id, f40.name, f40.ticker, ZERO, proofFor(f40.id), "", "", socials, 0, 0, buy, 0, { value: fee + buy });
    const r4 = await tx4.wait();
    const ev4 = parseEvent(launcher2, r4!.logs, "ItemClaimed");
    const token4 = (ev4!.args as string[])[1];
    console.log("  a second launcher with the same salt got a DIFFERENT token address:", token4, "≠", token);
    console.log("  → the factory mixes the sender into the CREATE2 salt; uniqueness rests on the launcher's own AlreadyClaimed check (one launcher, one address).");
  } catch (e) {
    console.log("  a second launcher with the same salt REVERTED:", (e as Error).message.slice(0, 120));
    console.log("  → the token address depends on the salt alone: same car = same address on any launcher, a second deployment cannot exist. Double guarantee.");
  }
  // Same salt, two plain EOAs straight at the factory, for the record.
  {
    const salt = ethers.keccak256(ethers.toUtf8Bytes("whips-determinism-probe"));
    const econEth = await factory.previewLaunchEconomics(0, ZERO);
    const params = ["Probe", "PRB", "", "", ["", "", "", "", ""], eoaA.address, 0, true, econEth, salt];
    const a = await factory.connect(eoaA).getFunction("launchToken").staticCall(params, 0, ZERO, [], { value: fee });
    await (await factory.connect(eoaA).getFunction("launchToken")(params, 0, ZERO, [], { value: fee })).wait();
    try {
      const b = await factory.connect(eoaB).getFunction("launchToken").staticCall([...params.slice(0, 5), eoaB.address, ...params.slice(6)], 0, ZERO, [], { value: fee });
      console.log("  factory: same salt from two EOAs →", a[0], "and", b[0], a[0] === b[0] ? "(same!)" : "(different: sender is part of the salt)");
    } catch (e) {
      console.log("  factory: same salt from a second EOA reverts →", (e as Error).message.slice(0, 80), "(salt alone decides the address)");
    }
    try {
      await factory.connect(eoaA).getFunction("launchToken").staticCall(params, 0, ZERO, [], { value: fee });
      console.log("  factory: same salt from the SAME sender again → accepted (no CREATE2 collision; only our AlreadyClaimed stops a re-claim)");
    } catch (e) {
      console.log("  factory: same salt from the SAME sender again reverts →", (e as Error).message.slice(0, 80));
      console.log("  → per launcher, an item can only ever produce one address: AlreadyClaimed plus a CREATE2 collision behind it. Double guarantee.");
    }
  }

  // ── 5. claimedIds paging ───────────────────────────────────────────────
  const ids = await launcher.claimedIds(0, 10);
  console.log("\n[5] claimedIds(0,10)", ids.map((x: bigint) => x.toString()).join(","), "| claimCount", (await launcher.claimCount()).toString());

  console.log("\nOK — WhipsLauncher works against the real Pons factory on this fork.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
