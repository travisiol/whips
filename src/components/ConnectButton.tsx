"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { useSyncExternalStore } from "react";
import { useConnect } from "wagmi";
import { shortAddress } from "@/lib/format";
import { FORK_WALLET } from "@/lib/wagmi";

const noop = () => () => {};
/** false during SSR and hydration, true once the client owns the tree. */
export const useMounted = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * RainbowKit's connect flow in the site's own pills. Three states: not
 * connected, wrong chain, connected. Nothing here sends a transaction.
 */
export function ConnectButton({ size = "sm", className = "" }: { size?: "sm" | "md"; className?: string }) {
  const sz = size === "sm" ? "btn-sm" : "";
  const { connect, connectors } = useConnect();
  const forkConnector = FORK_WALLET ? connectors.find((c) => c.id === "mock") : undefined;
  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        return (
          <div className={`flex items-center gap-2 ${className}`} aria-hidden={!ready} style={!ready ? { opacity: 0, pointerEvents: "none", userSelect: "none" } : undefined}>
            {!connected ? (
              <>
                <button type="button" className={`btn btn-ghost ${sz}`} onClick={openConnectModal}>
                  connect
                </button>
                {forkConnector ? (
                  <button type="button" className={`btn btn-ghost ${sz} border-dashed`} onClick={() => connect({ connector: forkConnector })} title="rehearsal: the fork's unlocked account">
                    fork wallet
                  </button>
                ) : null}
              </>
            ) : chain.unsupported ? (
              <button type="button" className={`btn btn-primary ${sz}`} onClick={openChainModal}>
                switch to robinhood chain
              </button>
            ) : (
              <button type="button" className={`btn btn-ghost ${sz} mono`} onClick={openAccountModal}>
                <span className="inline-block h-2 w-2 rounded-full bg-up" />
                {shortAddress(account.address)}
              </button>
            )}
          </div>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
