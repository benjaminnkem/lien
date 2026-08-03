"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">
            L
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Lien</div>
            <div className="text-[11px] text-zinc-500">
              Cleanverse RWA Firewall
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-600 dark:text-zinc-300 md:flex">
          <span className="text-zinc-400">Issuer</span>
          <span className="text-zinc-400">Lender</span>
          <span className="text-zinc-400">Compliance</span>
        </nav>
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
        />
      </div>
    </header>
  );
}
