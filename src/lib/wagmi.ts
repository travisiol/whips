import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, type Config, type CreateConnectorFn } from "wagmi";
import { mock } from "wagmi/connectors";
import { robinhoodChain } from "@/lib/chain";
import { site } from "@/lib/site";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const transports = { [robinhoodChain.id]: http() };

/**
 * Rehearsal only: with NEXT_PUBLIC_FORK_WALLET set to an unlocked account of
 * a local fork (contracts/scripts/serve-fork.ts prints one), a wagmi mock
 * connector signs through the fork's own node, so the whole launch and
 * trade flow can be played in the browser without a wallet extension. Unset
 * in production; it never appears otherwise.
 */
const forkWallet = process.env.NEXT_PUBLIC_FORK_WALLET?.trim();
export const FORK_WALLET: `0x${string}` | null = forkWallet && /^0x[0-9a-fA-F]{40}$/.test(forkWallet) ? (forkWallet as `0x${string}`) : null;
const rehearsal: CreateConnectorFn[] = FORK_WALLET ? [mock({ accounts: [FORK_WALLET], features: { reconnect: true } })] : [];

/**
 * With a WalletConnect project id: RainbowKit's full default wallet list.
 * Without one: injected wallets only, so the app works out of the box
 * instead of throwing at boot.
 */
export const wagmiConfig: Config = projectId
  ? getDefaultConfig({
      appName: site.name,
      appDescription: site.description,
      appUrl: site.url,
      projectId,
      chains: [robinhoodChain],
      transports,
      ssr: true,
    })
  : createConfig({
      chains: [robinhoodChain],
      connectors: [...connectorsForWallets([{ groupName: "browser wallets", wallets: [injectedWallet] }], { appName: site.name, projectId: "injected-only" }), ...rehearsal],
      transports,
      ssr: true,
    });

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
