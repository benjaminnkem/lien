"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

function RainbowKitThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <RainbowKitProvider
      initialChain={sepolia}
      theme={
        mode === "dark"
          ? darkTheme({
              accentColor: "#74f2c5",
              borderRadius: "medium",
            })
          : lightTheme({
              accentColor: "#133e37",
              borderRadius: "medium",
            })
      }
    >
      {children}
    </RainbowKitProvider>
  );
}

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
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RainbowKitThemeBridge>
              {children}
              <Toaster richColors position="top-right" closeButton />
            </RainbowKitThemeBridge>
          </TooltipProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
