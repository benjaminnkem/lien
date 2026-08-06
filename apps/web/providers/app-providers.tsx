"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { ReactLenis } from "lenis/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RainbowKitProvider
            initialChain={sepolia}
            theme={{
              lightMode: lightTheme({
                accentColor: "#133e37",
                borderRadius: "medium",
              }),
              darkMode: darkTheme({
                accentColor: "#74f2c5",
                borderRadius: "medium",
              }),
            }}
          >
            <ReactLenis root options={{ autoRaf: true, lerp: 0.09 }}>
              {children}
            </ReactLenis>
            <Toaster richColors position="top-right" closeButton />
          </RainbowKitProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
