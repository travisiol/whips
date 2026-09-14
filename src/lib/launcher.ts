import { whipsLauncherAbi } from "./abi/WhipsLauncher";

/**
 * The deployed WhipsLauncher. Nothing is configured until it is deployed:
 * `LAUNCHER_ADDRESS` is null, every car reads as unclaimed and the site
 * says "nothing launched yet" instead of pretending.
 */
export const launcherAbi = whipsLauncherAbi;

const raw = process.env.NEXT_PUBLIC_WHIPS_LAUNCHER?.trim();
export const LAUNCHER_ADDRESS: `0x${string}` | null = raw && /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as `0x${string}`) : null;

/** Block the launcher was deployed at — bounds the ItemClaimed log scan. */
export const LAUNCHER_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_WHIPS_DEPLOY_BLOCK?.trim() || "0");

export const launcherConfigured = LAUNCHER_ADDRESS !== null;
