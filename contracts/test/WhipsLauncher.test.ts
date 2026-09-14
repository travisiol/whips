import { expect } from "chai";
import { ethers } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/**
 * WhipsLauncher against the Pons mock. The mock keeps Pons' call shapes and
 * money rules (launch fee, ZeroAmount, native value, ERC-20 pull); the real
 * factory is exercised by scripts/fork-check.ts.
 */
const ZERO = ethers.ZeroAddress;
const SOCIALS = ["", "", "", "", ""] as [string, string, string, string, string];

type Leaf = [bigint, string, string, string];

const CATALOG: { id: number; name: string; symbol: string; pair: "eth" | "stock" }[] = [
  { id: 1, name: "Ferrari F40", symbol: "F40", pair: "eth" },
  { id: 2, name: "McLaren F1", symbol: "MCF1", pair: "eth" },
  { id: 94, name: "Tesla Cybertruck", symbol: "CYBERTRUCK", pair: "stock" },
  { id: 120, name: "Mazda Cosmo 110S", symbol: "COSMO", pair: "eth" },
];

async function deployFixture() {
  const [deployer, creator, other, trader] = await ethers.getSigners();
  const factory = await (await ethers.getContractFactory("MockPonsFactory")).deploy();
  const forwarder = await (await ethers.getContractFactory("MockLaunchForwarder")).deploy(await factory.getAddress());
  await factory.setForwarder(await forwarder.getAddress());
  const stock = await (await ethers.getContractFactory("MockERC20")).deploy("Tesla • Robinhood Token", "TSLA");

  const values: Leaf[] = CATALOG.map((c) => [BigInt(c.id), c.name, c.symbol, c.pair === "stock" ? (stock.target as string) : ZERO]);
  const tree = StandardMerkleTree.of(values, ["uint256", "string", "string", "address"]);
  const proofFor = (id: number) => {
    for (const [i, v] of tree.entries()) if (Number(v[0]) === id) return tree.getProof(i);
    throw new Error("no leaf");
  };
  const launcher = await (await ethers.getContractFactory("WhipsLauncher")).deploy(await factory.getAddress(), tree.root);
  const fee = await factory.launchFee();
  return { deployer, creator, other, trader, factory, forwarder, stock, launcher, tree, proofFor, fee };
}

function leafOf(id: number, name: string, symbol: string, pair: string) {
  return ethers.keccak256(ethers.concat([ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "string", "string", "address"], [id, name, symbol, pair]))]));
}

describe("WhipsLauncher", () => {
  it("wires the forwarder from the factory and rejects zero inputs", async () => {
    const { launcher, factory, forwarder, tree } = await loadFixture(deployFixture);
    expect(await launcher.factory()).to.equal(await factory.getAddress());
    expect(await launcher.forwarder()).to.equal(await forwarder.getAddress());
    expect(await launcher.catalogRoot()).to.equal(tree.root);
    expect(await launcher.SLUG()).to.equal("whips");
    const F = await ethers.getContractFactory("WhipsLauncher");
    await expect(F.deploy(ZERO, tree.root)).to.be.revertedWithCustomError(launcher, "ZeroAddress");
    await expect(F.deploy(await factory.getAddress(), ethers.ZeroHash)).to.be.revertedWithCustomError(launcher, "ZeroAddress");
  });

  it("computes the same leaf as the off-chain tree", async () => {
    const { launcher } = await loadFixture(deployFixture);
    expect(await launcher.leafFor(1, "Ferrari F40", "F40", ZERO)).to.equal(leafOf(1, "Ferrari F40", "F40", ZERO));
    expect(await launcher.saltFor(7)).to.equal(ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string", "uint256"], ["whips", 7])));
  });

  it("claims an item on the native curve in one transaction", async () => {
    const { launcher, creator, proofFor, fee, factory } = await loadFixture(deployFixture);
    const buy = ethers.parseEther("0.05");
    const tx = launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "ipfs://logo", "the f40", SOCIALS, 250, 0, buy, 0, { value: fee + buy });
    await expect(tx).to.emit(launcher, "ItemClaimed");
    const receipt = await (await tx).wait();
    const ev = receipt!.logs.map((l) => { try { return launcher.interface.parseLog({ topics: [...l.topics], data: l.data }); } catch { return null; } }).find((e) => e?.name === "ItemClaimed")!;
    const [itemId, token, curve, who, pair, symbol] = ev.args as unknown as [bigint, string, string, string, string, string];
    expect(itemId).to.equal(1n);
    expect(who).to.equal(creator.address);
    expect(pair).to.equal(ZERO);
    expect(symbol).to.equal("F40");

    const claim = await launcher.claims(1);
    expect(claim.token).to.equal(token);
    expect(claim.curve).to.equal(curve);
    expect(claim.launcher).to.equal(creator.address);
    expect(await launcher.isClaimed(1)).to.equal(true);
    expect(await launcher.claimCount()).to.equal(1n);

    // The first buy went to the creator, the fee recipient is the creator, buyback is on.
    const erc20 = await ethers.getContractAt("MockERC20", token);
    expect(await erc20.balanceOf(creator.address)).to.be.gt(0n);
    expect(await erc20.name()).to.equal("Ferrari F40");
    const launched = await factory.launches(await launcher.saltFor(1));
    expect(launched.creatorFeeRecipient).to.equal(creator.address);
    expect(launched.creatorTaxBps).to.equal(250);
    expect(launched.buybackEnabled).to.equal(true);
    expect(launched.sender).to.equal(await (await ethers.getContractAt("MockLaunchForwarder", await launcher.forwarder())).getAddress());
    // Nothing stays on the launcher.
    expect(await ethers.provider.getBalance(await launcher.getAddress())).to.equal(0n);
  });

  it("refuses a second claim of the same item", async () => {
    const { launcher, creator, other, proofFor, fee } = await loadFixture(deployFixture);
    const buy = ethers.parseEther("0.01");
    await launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, buy, 0, { value: fee + buy });
    await expect(launcher.connect(other).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, buy, 0, { value: fee + buy }))
      .to.be.revertedWithCustomError(launcher, "AlreadyClaimed")
      .withArgs(1);
  });

  it("refuses a proof that does not match the identity", async () => {
    const { launcher, creator, proofFor, fee, stock } = await loadFixture(deployFixture);
    const buy = ethers.parseEther("0.01");
    const bad = (args: [number, string, string, string, string[]]) =>
      launcher.connect(creator).launch(args[0], args[1], args[2], args[3], args[4], "", "", SOCIALS, 0, 0, buy, 0, { value: args[3] === ZERO ? fee + buy : fee });
    await expect(bad([2, "McLaren F1", "MCF1", ZERO, proofFor(1)])).to.be.revertedWithCustomError(launcher, "InvalidProof").withArgs(2);
    await expect(bad([2, "McLaren F2", "MCF1", ZERO, proofFor(2)])).to.be.revertedWithCustomError(launcher, "InvalidProof");
    await expect(bad([2, "McLaren F1", "MCF2", ZERO, proofFor(2)])).to.be.revertedWithCustomError(launcher, "InvalidProof");
    await expect(bad([2, "McLaren F1", "MCF1", stock.target as string, proofFor(2)])).to.be.revertedWithCustomError(launcher, "InvalidProof");
    await expect(bad([3, "Toyota 2000GT", "2000GT", ZERO, proofFor(2)])).to.be.revertedWithCustomError(launcher, "InvalidProof");
    await expect(bad([2, "McLaren F1", "MCF1", ZERO, []])).to.be.revertedWithCustomError(launcher, "InvalidProof");
  });

  it("requires a first buy and the exact value", async () => {
    const { launcher, creator, proofFor, fee } = await loadFixture(deployFixture);
    const buy = ethers.parseEther("0.01");
    await expect(launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, 0, 0, { value: fee })).to.be.revertedWithCustomError(launcher, "ZeroAmount");
    await expect(launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, buy, 0, { value: fee }))
      .to.be.revertedWithCustomError(launcher, "NativeValueMismatch")
      .withArgs(fee + buy, fee);
    await expect(launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, buy, 0, { value: fee + buy + 1n })).to.be.revertedWithCustomError(launcher, "NativeValueMismatch");
    expect(await launcher.valueFor(ZERO, buy)).to.equal(fee + buy);
  });

  it("claims a stock-paired item by pulling the pair token through approve → launcher → forwarder", async () => {
    const { launcher, creator, proofFor, fee, stock, forwarder } = await loadFixture(deployFixture);
    const amount = ethers.parseEther("0.3");
    await stock.mint(creator.address, amount);
    expect(await launcher.valueFor(stock.target as string, amount)).to.equal(fee);
    // Without approval the pull fails.
    await expect(launcher.connect(creator).launch(94, "Tesla Cybertruck", "CYBERTRUCK", stock.target as string, proofFor(94), "", "", SOCIALS, 0, 0, amount, 0, { value: fee })).to.be.reverted;
    await stock.connect(creator).approve(await launcher.getAddress(), amount);
    // The value must be the fee only.
    await expect(launcher.connect(creator).launch(94, "Tesla Cybertruck", "CYBERTRUCK", stock.target as string, proofFor(94), "", "", SOCIALS, 0, 0, amount, 0, { value: fee + amount }))
      .to.be.revertedWithCustomError(launcher, "NativeValueMismatch")
      .withArgs(fee, fee + amount);
    const tx = await launcher.connect(creator).launch(94, "Tesla Cybertruck", "CYBERTRUCK", stock.target as string, proofFor(94), "", "", SOCIALS, 100, 0, amount, 0, { value: fee });
    const receipt = await tx.wait();
    const ev = receipt!.logs.map((l) => { try { return launcher.interface.parseLog({ topics: [...l.topics], data: l.data }); } catch { return null; } }).find((e) => e?.name === "ItemClaimed")!;
    const [, token, curve, , pair] = ev.args as unknown as [bigint, string, string, string, string];
    expect(pair).to.equal(stock.target);
    const curveC = await ethers.getContractAt("MockCurve", curve);
    expect(await curveC.pairToken()).to.equal(stock.target);
    expect(await stock.balanceOf(curve)).to.equal(amount);
    expect(await stock.balanceOf(await launcher.getAddress())).to.equal(0n);
    expect(await stock.balanceOf(await forwarder.getAddress())).to.equal(0n);
    expect(await stock.balanceOf(creator.address)).to.equal(0n);
    const erc20 = await ethers.getContractAt("MockERC20", token);
    expect(await erc20.balanceOf(creator.address)).to.be.gt(0n);
  });

  it("passes minTokensOut through to the curve", async () => {
    const { launcher, creator, proofFor, fee } = await loadFixture(deployFixture);
    const buy = ethers.parseEther("0.01");
    await expect(launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, buy, ethers.parseEther("999999999"), { value: fee + buy })).to.be.reverted;
  });

  it("pages claimed ids in claim order", async () => {
    const { launcher, creator, other, proofFor, fee } = await loadFixture(deployFixture);
    const buy = ethers.parseEther("0.01");
    await launcher.connect(creator).launch(120, "Mazda Cosmo 110S", "COSMO", ZERO, proofFor(120), "", "", SOCIALS, 0, 0, buy, 0, { value: fee + buy });
    await launcher.connect(other).launch(2, "McLaren F1", "MCF1", ZERO, proofFor(2), "", "", SOCIALS, 0, 0, buy, 0, { value: fee + buy });
    await launcher.connect(creator).launch(1, "Ferrari F40", "F40", ZERO, proofFor(1), "", "", SOCIALS, 0, 0, buy, 0, { value: fee + buy });
    expect((await launcher.claimedIds(0, 0)).map(Number)).to.deep.equal([120, 2, 1]);
    expect((await launcher.claimedIds(1, 1)).map(Number)).to.deep.equal([2]);
    expect((await launcher.claimedIds(1, 50)).map(Number)).to.deep.equal([2, 1]);
    expect((await launcher.claimedIds(9, 5)).map(Number)).to.deep.equal([]);
    expect(await launcher.claimCount()).to.equal(3n);
  });

  it("gives the same car the same salt, so a per-sender CREATE2 factory reuses the address", async () => {
    const { launcher } = await loadFixture(deployFixture);
    expect(await launcher.saltFor(1)).to.equal(await launcher.saltFor(1));
    expect(await launcher.saltFor(1)).to.not.equal(await launcher.saltFor(2));
  });

  it("stores nothing that could be swept: no owner, no receive", async () => {
    const { launcher, deployer } = await loadFixture(deployFixture);
    await expect(deployer.sendTransaction({ to: await launcher.getAddress(), value: 1n })).to.be.reverted;
    const iface = launcher.interface;
    expect(iface.fragments.some((f) => f.type === "function" && (f as { name: string }).name === "owner")).to.equal(false);
  });
});
