# whips — launch tokens. paired with cars.

pick a legend. launch its token on robinhood chain in one transaction. the car becomes the token's identity.

whips is a launcher on top of Pons V2 (Robinhood Chain): a fixed catalog of 120 iconic cars, one token per car, claimed once. The catalog is committed to the launcher contract as a Merkle root, so a car can only be launched with its real name, ticker and pair — and never twice. Every launch is Pons' own `launchAndBuy` (launch + first buy in one transaction) with the claiming wallet as creator-fee recipient. No platform token, no platform fee.

The twist: when a car's maker is listed and pairable on Pons, the curve is quoted in the maker's stock token — Tesla → TSLA, Ford → F, Rivian → RIVN. Everything else pairs with ETH. "paired twice: with the car, and with its maker."

Every car is shown as **itself**: a real photograph from Wikimedia Commons under a free licence (CC0, public domain, CC BY, CC BY-SA), cut out of its background and lit in the showroom — on the cards, on the sheet, on the hero's ring of light, and in the token's default logo. Every photo is credited on the car's sheet and on `/credits`; that credit is the licence's condition and stays with the photo. Google Images is not a source: those photos belong to their photographers.

```bash
npm run photos:fetch     # picks one free Commons photo per car → public/cars/raw + src/data/photos.json
npm run photos:cutout    # removes backgrounds (rembg, CPU) → public/cars/<slug>.png
npm run photos:pack      # WebP for the site + a small PNG for the logo route
```

`scripts/fetch-photos.mts` searches Commons per car (toys, renders, interiors, rear views filtered out), prefers front three-quarter shots, and records the file, author and licence. `PICKS` in that script forces a specific file where the search picked wrong — ~30 cars were hand-picked after a contact-sheet review. To swap a photo: put the Commons file title in `PICKS`, run `photos:fetch <slug>`, then `photos:cutout <slug>` and `photos:pack`. A car with no photo falls back to the generated die-cast below.

Behind the photos, a generated 3D layer remains for the wordmark and as the fallback: the body is *lofted* from the car's real length, width and height (`src/data/dims.ts`) and its side profile (25 hand-drawn grails + parametric coupé / sedan / roadster / pickup / wagon / hatch templates) — a plan-view width, a rounded cross-section with sills and tumblehome, a narrower roof, the greenhouse tagged as dark glass in the same mesh — plus chrome-dish wheels in dark wells, a wing when the car has one, clearcoat flake paint, on a turntable over wet asphalt. Not a single raster asset: the environment map, the flake texture and the ring of light are painted at runtime; the wordmark is chrome `TextGeometry` cut from the embedded OFL Archivo. The garage grid draws every bay through one shared offscreen renderer (`src/lib/three/thumbs.ts`), so 120 cars are 3D without 120 WebGL contexts. Without WebGL the same profiles render as SVG; under `prefers-reduced-motion` a single frame is painted.

> cars are references, not partners. not affiliated with any maker.

## Layout

```
src/
  app/                landing (/), the garage (/garage), api routes, /logo/<car>.png
  components/         HeroScene, CarStage (three.js), CarSvg, garage/* (bays, sheet, launch, trade)
  data/catalog.ts     the 120 cars: id, name, maker, year, ticker, tier, 0–100, top speed, units, blurb, shape
  data/profiles.ts    hand-drawn silhouettes (25 grails + the cybertruck)
  data/pairs.ts       ETH / TSLA / F / RIVN — addresses read from the chain, with the evidence
  data/dims.ts        real length / width / height per car, what the fallback bodies are lofted to
  data/photos.json    the chosen Commons photo per car: file, author, licence, page (scripts/fetch-photos.mts)
  data/photos.ts      accessors + credit line
  app/credits         photo credits page
  data/catalog-tree.json  Merkle root + proof per car (npm run catalog:root)
  lib/profile.ts      2D profile generator shared by SVG and three.js
  lib/three/          studio (env map, materials, loop), body loft, car builder, wet floor, wordmark, shared thumb renderer
  lib/garage.ts       server-side chain reader (multicall + logs), 15 s cache
  lib/site.ts         the name lives here, and nowhere else
contracts/            Hardhat 2 · OpenZeppelin 5 · Solidity 0.8.28 (via-IR)
  contracts/WhipsLauncher.sol
  scripts/fork-check.ts   the proof against the real Pons factory on a fork
  scripts/serve-fork.ts   seeded fork for front-end rehearsal
scripts/              catalog root builder, font → glyph converter, chain probes
public/fonts/         Archivo Black Italic (instanced from the OFL variable font) + OFL.txt
public/cars/          <slug>.webp cutouts (site), png/<slug>.png (logo route), raw/<slug>.jpg (originals)
```

## Run it

```bash
npm install
npm --prefix contracts install
npm run dev -- --port 3810
```

Without a launcher address the site reads as empty ("nothing launched yet. the garage is empty.") and the launch form is disabled. Nothing is faked: every live number (cap, progress, holders, fees) is read from Robinhood Chain via Multicall3 and `eth_getLogs`, refreshed every 15 seconds, and the spec figures are catalog data (a tilde marks a figure rounded from published tests; "not disclosed" means the maker never published one).

Copy `.env.example` to `.env.local` for the optional bits (WalletConnect project id, Pinata JWT for logo uploads, site URL).

## The contract

`contracts/contracts/WhipsLauncher.sol` — immutable, no owner.

```
launch(itemId, name, symbol, pairToken, proof, logo, description, socials, creatorTaxBps, configId, buyAmount, minTokensOut) payable
```

1. `buyAmount == 0` → `ZeroAmount()`; `claims[itemId]` set → `AlreadyClaimed(itemId)`.
2. `proof` must verify `keccak256(bytes.concat(keccak256(abi.encode(itemId, name, symbol, pairToken))))` against `catalogRoot` (OpenZeppelin `StandardMerkleTree` leaves) → else `InvalidProof(itemId)`.
3. Native pair: `msg.value == factory.launchFee() + buyAmount`. ERC-20 pair: `msg.value == factory.launchFee()`, the pair token is pulled from the caller (`approve` first) and approved to the forwarder — the forwarder pulls it from its caller, exactly as the Pons front end does it (read off mainnet transactions).
4. `forwarder.launchAndBuy(params, configId, pairToken, buyAmount, minTokensOut, msg.sender, [])` with `creatorFeeRecipient = msg.sender`, `buybackEnabled = true`, `economicsHash = factory.previewLaunchEconomics(configId, pairToken)`, `salt = keccak256(abi.encode("whips", itemId))`.
5. Stores `claims[itemId] = (token, curve, launcher)`, emits `ItemClaimed`.

Views: `claims(id)`, `isClaimed(id)`, `claimCount()`, `claimedIds(offset, limit)`, `leafFor(...)`, `saltFor(id)`, `ponsLaunchFee()`, `valueFor(pair, buy)`.

### Proven on a fork (2026-09-14)

`FORK_URL=https://rpc.mainnet.chain.robinhood.com npm --prefix contracts run fork:check` — an in-process Hardhat fork of Robinhood Chain against the real Pons V2 factory (`0x7eD5…EC7e`), forwarder (`0xe33e…2948`) and fee escrow:

- claim of the Ferrari F40 on the ETH curve through the forwarder: ~3.95 M gas, tokens delivered to the caller, `curve.deployer()` = the caller (fee recipient), `buybackEnabled` true, caller and launcher snipe-tax exempt;
- a buy and a sell on the new curve match the local constant-product quote **to the wei**;
- the six reverts: double claim, someone else's proof, wrong name, wrong pair, zero buy, wrong value;
- a **stock-paired claim** (Tesla Cybertruck → TSLA) paid in real TSLA borrowed from a mainnet holder, `curve.pairToken()` = TSLA, graduation threshold 26 TSLA, nothing left on the launcher;
- **CREATE2**: the factory mixes the sender into the salt — the same item from a second launcher gets a different address, and two EOAs using the same salt get different tokens — but the **same sender reusing a salt is refused by the factory itself**. So on *this* launcher every car maps to exactly one address, twice over: the `AlreadyClaimed` check, and the factory's refusal behind it. A second launcher would mint different addresses, which is why there is one launcher.

Plus 11 unit tests on a Pons mock (`npm --prefix contracts test`).

The three stock-pair addresses were read from the chain, never guessed: the pair-token field of the factory's `TokenLaunched` logs, then `symbol()` / `name()` / `decimals()` on each address (`scripts/probe/probe-pairs.mjs`). Every launch on the factory so far, stock-paired included, used launch config 0.

### After a launch — what exists, who sees what

The moment `launch` confirms there is nothing left to do and nothing left to trust:

- **The token and its curve exist in the Pons V2 factory**, deployed by the forwarder like every other Pons token — `factory.TokenLaunched` fires for it, Pons' own site lists it at `ponsfamily.com/launchpad/<token>`, Blockscout indexes it. The name, ticker, logo URL, description and socials are **stored in the token contract itself** (`name()`, `symbol()`, `logo()`, `description()`, `socials()`); the sheet reads them back and shows them under "on chain", proof the identity landed. `deployer()` on the token is the launcher contract (it is the forwarder's caller); the person is `claims[itemId].launcher`, and that is where the creator fees go.
- **The creator sees their CA.** The sheet flips from the launch form to the claimed view with the contract address, a copy button, the Blockscout link, the Pons link and a "share on x" intent that carries the ticker, the CA and the car's `?car=` link. The home page's "latest launches" strip picks it up on the next read.
- **Everyone else sees "taken".** The garage is read from the launcher (`claimedIds` → `claims`), server-rendered and refreshed every 15 s: the bay shows `taken · $ticker · 0xlauncher`, its live cap and its progress to graduation, and the sheet opens on the trade panel. Nobody can launch the car again — `AlreadyClaimed`, and the factory's own salt refusal behind it.
- **The money.** Pons takes its trade fee on every buy and sell (read live: 1%, 30% of it to the protocol → the creator's share is **0.7% of volume**); the creator's part accrues on the curve, Pons sweeps it to the fee escrow, and the creator withdraws it from **"your cars"** at the top of the garage — a wallet-scoped panel listing the cars they launched, what is accruing on each curve, what is already in the escrow, and one button per currency (`escrow.claim()` for ETH, `escrow.claimToken(pair)` for TSLA / F / RIVN). At the curve's threshold (`graduationThreshold()`, 4.2 ETH on an ETH pair, 26 TSLA on the Cybertruck) Pons graduates it to a pool; the bay and the sheet then read `graduated` and the trade panel points to Pons.

### Rehearse the front end on a fork

```bash
FORK_URL=https://rpc.mainnet.chain.robinhood.com PORT=8556 npm --prefix contracts run fork:serve
```

It deploys the launcher from a fixed rehearsal key (nonce 0 on mainnet, so the launcher lands on the same address every run — `node scripts/probe/predict-launcher.mjs` prints it, which lets you write `.env.local` and start `next dev` *before* the fork is up), seeds two claims (F40 on ETH with trades, Cybertruck on TSLA), credits the escrow as if a curve had swept fees, funds an unlocked account and prints the `NEXT_PUBLIC_*` lines for a temporary `.env.local`. `NEXT_PUBLIC_FORK_WALLET` enables a rehearsal-only wagmi mock connector ("fork wallet" button) that signs through the fork's node. Played from the browser this way, on 2026-09-14: launch, approve → launch (stock pair), buy, sell, the claimed sheet (CA, copy, share, on-chain identity), "your cars" with a fee claim mined against the real escrow, the "taken" bay and the home strip. Delete `.env.local` and restart `next dev` afterwards; `NEXT_PUBLIC_*` values are fixed at start-up.

The public RPC forgets the pinned block's state after ~10 minutes; from then on any *new* storage read (an empty bay's `claims` slot, a new token's address) makes the in-process fork panic with `metadata is not found`. The site itself just reports the failed read.

## Before mainnet

1. **Deploy the launcher.** `cd contracts && cp .env.example .env` (a funded `DEPLOYER_PRIVATE_KEY`), then `npm run deploy:robinhood`. The script reads `catalogRoot` from `src/data/catalog-tree.json` and writes `contracts/deployments/robinhood.json`; `next.config.ts` picks the address up from there (or set `NEXT_PUBLIC_WHIPS_LAUNCHER` + `NEXT_PUBLIC_WHIPS_DEPLOY_BLOCK`). `npm run verify:robinhood` verifies on Blockscout.
2. **Freeze the catalog first.** The root is immutable in the contract. Any change to a car's id, name, ticker or pair after deployment means a new launcher. Re-run `npm run catalog:root` after the last edit and commit the JSON.
3. **Stock-pair addresses.** TSLA `0x322f…3b2d`, F `0x25c2…be0c`, RIVN `0xb1bf…114b` — read from the chain on 2026-09-14 and exercised on the fork for TSLA. If Pons delists a pair, launches of those cars would revert at `previewLaunchEconomics`/the factory; move the maker to ETH in `src/data/pairs.ts` and rebuild the root **before** deploying.
4. **Marks and photos.** Car names, makers and model names are used as references. Nothing here is endorsed by any manufacturer; the footer and the FAQ say so. Take legal advice before using maker names in a commercial product, and keep the "references, not partners" line. The photos are free-licence Commons files: keep `/credits` and the per-sheet credit line online (CC BY / CC BY-SA require attribution), and if you replace a photo, replace it with one you have the right to use — not a Google Images result.
5. **Site URL and metadata.** `NEXT_PUBLIC_SITE_URL` (used for metadata and as the default token-logo origin), `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for the full wallet list, `PINATA_JWT` if you want uploads.
6. **Hosting.** `/api/garage`, `/api/car/[id]` and `/logo/[slug]` are Node route handlers with an in-memory 15 s cache; run on a Node host (or Vercel serverless — the cache is then per instance, which is fine).
7. **The name.** `whips` is a placeholder. It lives in `src/lib/site.ts` only.

## Open decisions

- Tier placement is editorial (a few sub-500-unit cars sit on other floors; the grail floor is the 25 we chose). The spec figures carry an `approx` flag where they come from tests rather than a factory sheet.
- The first buy's `minTokensOut` is sent as 0: launch and buy are atomic on a curve that does not exist yet, so nothing can front-run it. The trade panel uses real slippage.
- Creator tax defaults to 0 and can go up to the factory's `maxCreatorTaxBps`.
- Holders are computed from `Transfer` logs since the launch block (the curve excluded), capped to the last 400k blocks when the launch block is unknown.

## Disclaimer

cars are references, not partners. not affiliated with any maker. tokens on a bonding curve can go to zero. this is software, not advice.
