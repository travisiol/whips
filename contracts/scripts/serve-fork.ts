import * as http from "http";
import { ethers, network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { CARS, pairOf } from "../../src/data/catalog";
import { PAIRS } from "../../src/data/pairs";

/**
 * Front-end rehearsal without a live deployment: seeds the in-process fork
 * (FORK_URL) with the launcher and a few claims, warms every view the site
 * reads, then serves that network over JSON-RPC on PORT (default 8546) so
 * the site can be pointed at it:
 *
 *   FORK_URL=https://rpc.mainnet.chain.robinhood.com npm run fork:serve
 *
 *   NEXT_PUBLIC_WHIPS_LAUNCHER=<printed>
 *   NEXT_PUBLIC_WHIPS_DEPLOY_BLOCK=<printed>
 *   NEXT_PUBLIC_ROBINHOOD_RPC_URL=http://127.0.0.1:8546
 *   NEXT_PUBLIC_ROBINHOOD_CHAIN_ID=31337
 *   NEXT_PUBLIC_FORK_WALLET=<hardhat account #1>   (a rehearsal-only wagmi mock connector)
 *
 * Why in-process rather than `hardhat node`: the public Robinhood RPC keeps
 * little history, and a forked node that runs for minutes starts failing
 * remote reads. Seeding in one go and touching every slot the site reads
 * keeps everything cached.
 *
 * Seeded: the F40 (ETH pair) claimed by account #2 with a few trades from
 * accounts #3 and #4; the Cybertruck (TSLA pair) claimed by account #2 with
 * borrowed TSLA. Account #1 stays free to claim anything from the browser.
 */
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const PONS_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const PORT = Number(process.env.PORT ?? 8546);
const ZERO = ethers.ZeroAddress;

const CURVE_ABI = [
  "function getReserves() view returns (uint256,uint256)",
  "function realQuoteReserve() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function launchSupply() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function quoteFeeBalance() view returns (uint256)",
  "function protocolFeeShareBps() view returns (uint256)",
  "function pairToken() view returns (address)",
  "function currentSnipeTaxBps(address) view returns (uint256)",
  "function buy(uint256,uint256,address) payable returns (uint256)",
  "function sell(uint256,uint256,address) returns (uint256)",
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const ESCROW_ABI = ["function balanceOf(address) view returns (uint256)", "function balanceOfToken(address,address) view returns (uint256)"];

async function borrow(token: string, to: string, amount: bigint) {
  const erc20 = new ethers.Contract(token, ERC20_ABI, ethers.provider);
  const head = await ethers.provider.getBlockNumber();
  // The public RPC caps a query at 10k logs; a busy stock token fills that fast, so shrink the window until it fits.
  let logs: Awaited<ReturnType<typeof erc20.queryFilter>> = [];
  for (const span of [1_200, 400, 120]) {
    try {
      logs = await erc20.queryFilter(erc20.filters.Transfer(), head - span, head);
      break;
    } catch {
      /* too many logs — narrower window */
    }
  }
  const seen = new Set<string>();
  for (let i = logs.length - 1; i >= 0; i--) {
    const holder = (logs[i] as { args: { to: string } }).args.to;
    if (seen.has(holder) || holder === ZERO) continue;
    seen.add(holder);
    if (((await erc20.balanceOf(holder)) as bigint) < amount) continue;
    await network.provider.send("hardhat_impersonateAccount", [holder]);
    await network.provider.send("hardhat_setBalance", [holder, "0x56BC75E2D63100000"]);
    await (await erc20.connect(await ethers.getSigner(holder)).getFunction("transfer")(to, amount)).wait();
    await network.provider.send("hardhat_stopImpersonatingAccount", [holder]);
    return holder;
  }
  throw new Error("no holder found to borrow " + token);
}

async function main() {
  const [, browser, creator, traderA, traderB] = await ethers.getSigners();
  // A deployer nobody uses on mainnet (nonce 0 forever), so the launcher lands
  // on the same address every run and the dev server can be started, with
  // that address in .env.local, before the fork is even up.
  const deployer = new ethers.Wallet(ethers.keccak256(ethers.toUtf8Bytes("whips rehearsal deployer")), ethers.provider);
  await network.provider.send("hardhat_setBalance", [deployer.address, "0x56BC75E2D63100000"]);
  if ((await ethers.provider.getCode(PONS_FACTORY)) === "0x") throw new Error("no Pons factory code — set FORK_URL to a Robinhood Chain RPC");

  const values = CARS.map((c) => [BigInt(c.id), c.name, c.ticker, pairOf(c).address] as [bigint, string, string, string]);
  const tree = StandardMerkleTree.of(values, ["uint256", "string", "string", "address"]);
  const proofFor = (id: number) => {
    for (const [i, v] of tree.entries()) if (Number(v[0]) === id) return tree.getProof(i);
    throw new Error("no leaf");
  };

  const launcher = await (await ethers.getContractFactory("WhipsLauncher", deployer)).deploy(PONS_FACTORY, tree.root);
  const deployReceipt = await launcher.deploymentTransaction()?.wait();
  await launcher.waitForDeployment();
  const launcherAddress = await launcher.getAddress();
  const deployBlock = deployReceipt?.blockNumber ?? (await ethers.provider.getBlockNumber());
  const fee = (await launcher.ponsLaunchFee()) as bigint;
  const socials = ["", "", "", "", ""] as [string, string, string, string, string];

  const claim = async (ticker: string, signer: import("ethers").Signer, buy: bigint, taxBps = 0) => {
    const car = CARS.find((c) => c.ticker === ticker)!;
    const pair = pairOf(car);
    const stock = pair.address !== ZERO;
    if (stock) {
      await borrow(pair.address, await signer.getAddress(), buy);
      await (await new ethers.Contract(pair.address, ERC20_ABI, signer).getFunction("approve")(launcherAddress, buy)).wait();
    }
    const tx = await launcher
      .connect(signer)
      .launch(car.id, car.name, car.ticker, pair.address, proofFor(car.id), `http://localhost:3810/logo/${car.slug}.png`, car.blurb, socials, taxBps, 0, buy, 0, { value: stock ? fee : fee + buy });
    await tx.wait();
    const c = await launcher.claims(car.id);
    return { car, token: c.token as string, curve: new ethers.Contract(c.curve as string, CURVE_ABI, ethers.provider), pair };
  };

  const buyOn = async (curve: import("ethers").Contract, who: import("ethers").Signer, amount: bigint) => {
    await (await curve.connect(who).getFunction("buy")(amount, 0, await who.getAddress(), { value: amount })).wait();
  };

  // F40 on ETH, claimed by `creator`, traded by two strangers, one partial sell.
  const f40 = await claim("F40", creator, ethers.parseEther("0.02"));
  await buyOn(f40.curve, traderA, ethers.parseEther("0.12"));
  await buyOn(f40.curve, traderB, ethers.parseEther("0.05"));
  const f40Token = new ethers.Contract(f40.token, ERC20_ABI, ethers.provider);
  const balA = (await f40Token.balanceOf(traderA.address)) as bigint;
  await (await f40Token.connect(traderA).getFunction("approve")(await f40.curve.getAddress(), balA / 3n)).wait();
  await (await f40.curve.connect(traderA).getFunction("sell")(balA / 3n, 0, traderA.address)).wait();
  console.log("seeded  $F40      token", f40.token, "curve", await f40.curve.getAddress());

  // Cybertruck on TSLA, claimed by `creator` with borrowed TSLA and a 1% creator tax.
  const cyber = await claim("CYBERTRUCK", creator, ethers.parseEther("0.3"), 100);
  console.log("seeded  $CYBERTRUCK token", cyber.token, "curve", await cyber.curve.getAddress(), "pair", await cyber.curve.pairToken());

  // Pons sweeps curve fees to its escrow on its own schedule; on the fork we
  // stand in for a curve and credit the escrow ourselves, so the "claim your
  // fees" path can be rehearsed. The escrow's credit(address) is what a curve
  // calls when it sweeps; impersonating the F40 curve gets past its guard.
  try {
    const curveAddr = await f40.curve.getAddress();
    await network.provider.send("hardhat_impersonateAccount", [curveAddr]);
    await network.provider.send("hardhat_setBalance", [curveAddr, "0x56BC75E2D63100000"]);
    const asCurve = await ethers.getSigner(curveAddr);
    const escrowW = new ethers.Contract(PONS_ESCROW, ["function credit(address) payable"], asCurve);
    await (await escrowW.credit(creator.address, { value: ethers.parseEther("0.012") })).wait();
    await (await escrowW.credit(browser.address, { value: ethers.parseEther("0.0031") })).wait();
    await network.provider.send("hardhat_stopImpersonatingAccount", [curveAddr]);
    const escrowR = new ethers.Contract(PONS_ESCROW, ESCROW_ABI, ethers.provider);
    console.log("escrow credited — creator", ethers.formatEther(await escrowR.balanceOf(creator.address)), "browser", ethers.formatEther(await escrowR.balanceOf(browser.address)));
  } catch (e) {
    console.log("could not credit the escrow as a curve:", (e as Error).message.slice(0, 120));
  }

  // The browser account: funded with ETH and some TSLA so it can claim anything.
  await borrow(PAIRS.TSLA.address, browser.address, ethers.parseEther("1"));
  console.log("browser account", browser.address, "ETH", ethers.formatEther(await ethers.provider.getBalance(browser.address)), "TSLA", ethers.formatEther(await new ethers.Contract(PAIRS.TSLA.address, ERC20_ABI, ethers.provider).balanceOf(browser.address)));

  // Warm the slots the site reads (the public RPC forgets the pinned state
  // within minutes, so this has to be quick: one pass, nothing twice).
  await launcher.claimCount();
  await launcher.claimedIds(0, 0);
  const escrow = new ethers.Contract(PONS_ESCROW, ESCROW_ABI, ethers.provider);
  // "your cars" asks the escrow for every pair, for whoever is connected.
  for (const who of [browser.address, creator.address]) {
    await escrow.balanceOf(who).catch(() => null);
    for (const sym of ["TSLA", "F", "RIVN"] as const) await escrow.balanceOfToken(PAIRS[sym].address, who).catch(() => null);
  }
  for (const seeded of [f40, cyber]) {
    const curve = seeded.curve;
    for (const fn of ["getReserves", "realQuoteReserve", "graduationThreshold", "graduated", "launchSupply", "feeBps", "creatorTaxBps", "quoteFeeBalance", "protocolFeeShareBps", "pairToken"]) await curve.getFunction(fn)().catch(() => null);
    await curve.currentSnipeTaxBps(browser.address).catch(() => null);
    const erc20 = new ethers.Contract(seeded.token, ERC20_ABI, ethers.provider);
    for (const a of [browser.address, creator.address]) {
      await erc20.balanceOf(a);
      await erc20.allowance(a, await curve.getAddress());
    }
    if (seeded.pair.address === ZERO) await escrow.balanceOf(creator.address).catch(() => null);
    else await escrow.balanceOfToken(seeded.pair.address, creator.address).catch(() => null);
    // The on-chain identity block on the sheet.
    const meta = new ethers.Contract(seeded.token, ["function name() view returns (string)", "function symbol() view returns (string)", "function logo() view returns (string)", "function description() view returns (string)", "function socials() view returns (string[5])", "function deployer() view returns (address)"], ethers.provider);
    for (const fn of ["name", "symbol", "logo", "description", "socials", "deployer"]) await meta.getFunction(fn)().catch(() => null);
  }
  const factory = new ethers.Contract(PONS_FACTORY, ["function launchFee() view returns (uint256)", "function maxCreatorTaxBps() view returns (uint256)"], ethers.provider);
  await factory.launchFee();
  await factory.maxCreatorTaxBps().catch(() => null);
  const tsla = new ethers.Contract(PAIRS.TSLA.address, ERC20_ABI, ethers.provider);
  await tsla.balanceOf(browser.address);
  await tsla.allowance(browser.address, launcherAddress);
  if ((await ethers.provider.getCode(MULTICALL3)) === "0x") console.log("warning: no Multicall3 on this fork");

  console.log(`\nNEXT_PUBLIC_WHIPS_LAUNCHER=${launcherAddress}`);
  console.log(`NEXT_PUBLIC_WHIPS_DEPLOY_BLOCK=${deployBlock}`);
  console.log(`NEXT_PUBLIC_ROBINHOOD_RPC_URL=http://127.0.0.1:${PORT}`);
  console.log("NEXT_PUBLIC_ROBINHOOD_CHAIN_ID=31337");
  console.log(`NEXT_PUBLIC_FORK_WALLET=${browser.address}`);
  console.log(`(deployer ${deployer.address})`);

  const server = http.createServer((req, res) => {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end("bad json");
        return;
      }
      const handle = async (call: { id?: unknown; method: string; params?: unknown[] }) => {
        try {
          const result = await network.provider.request({ method: call.method, params: call.params ?? [] });
          return { jsonrpc: "2.0", id: call.id ?? null, result };
        } catch (e) {
          const err = e as { code?: number; message?: string; data?: unknown };
          return { jsonrpc: "2.0", id: call.id ?? null, error: { code: typeof err.code === "number" ? err.code : -32000, message: err.message ?? "error", data: err.data } };
        }
      };
      const out = Array.isArray(payload) ? await Promise.all(payload.map(handle)) : await handle(payload as { method: string });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  server.listen(PORT, () => console.log(`\nserving the seeded fork on http://127.0.0.1:${PORT} — Ctrl+C to stop`));
  await new Promise(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
