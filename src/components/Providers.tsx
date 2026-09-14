"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, type Theme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { site } from "@/lib/site";
import { wagmiConfig } from "@/lib/wagmi";

const base = darkTheme({
  accentColor: "#2a5bff",
  accentColorForeground: "#ffffff",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

/** RainbowKit re-skinned to the showroom so the modal never looks foreign. */
const theme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    modalBackground: "#111116",
    modalBackdrop: "rgba(10, 10, 12, 0.78)",
    modalBorder: "#1f1f27",
    modalText: "#f2f3f5",
    modalTextSecondary: "#7d828d",
    modalTextDim: "#4d515b",
    generalBorder: "#1f1f27",
    generalBorderDim: "#16161c",
    profileForeground: "#111116",
    profileAction: "#16161c",
    profileActionHover: "#1f1f27",
    connectButtonBackground: "#111116",
    connectButtonInnerBackground: "#16161c",
    connectButtonText: "#f2f3f5",
    menuItemBackground: "#16161c",
    closeButtonBackground: "#16161c",
    closeButton: "#7d828d",
    actionButtonBorder: "#1f1f27",
    actionButtonBorderMobile: "#1f1f27",
    actionButtonSecondaryBackground: "#16161c",
    selectedOptionBorder: "rgba(42, 91, 255, 0.5)",
    connectionIndicator: "#2a5bff",
    downloadBottomCardBackground: "#111116",
    downloadTopCardBackground: "#16161c",
  },
  fonts: { body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  radii: { ...base.radii, modal: "24px", modalMobile: "24px", menuButton: "16px", actionButton: "9999px", connectButton: "9999px" },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 } } }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} appInfo={{ appName: site.name }} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
