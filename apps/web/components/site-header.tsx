"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";
import { Home, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const roles = [
  { href: "/", label: "Home", icon: Home },
  { href: "/demo", label: "Attack demo", icon: ShieldAlert },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/65 bg-background/82 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl bg-[#102a26] text-sm font-semibold text-white shadow-sm">
            <span className="absolute -right-2 -bottom-2 size-6 rounded-full bg-[#74f2c5]/60 blur-sm transition-transform group-hover:scale-125" />
            <span className="relative">L</span>
          </span>
          <span className="hidden leading-tight min-[380px]:block">
            <span className="block font-heading text-[15px] font-semibold tracking-tight">
              LIEN
            </span>
            <span className="block text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Encumbrance control plane
            </span>
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="flex items-center rounded-full border border-border/75 bg-muted/55 p-1"
        >
          {roles.map((role) => {
            const active =
              role.href === "/"
                ? pathname === "/"
                : pathname.startsWith(role.href);
            const Icon = role.icon;
            return (
              <Link
                key={role.href}
                href={role.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors sm:px-3",
                  active && "text-foreground",
                )}
              >
                <AnimatePresence>
                  {active && (
                    <motion.span
                      layoutId="role-navigation-active"
                      className="absolute inset-0 rounded-full bg-background shadow-sm ring-1 ring-border/70"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                </AnimatePresence>
                <Icon className="relative size-3.5" />
                <span className="relative hidden sm:inline">{role.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 md:block">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
        <div className="flex size-2 shrink-0 items-center md:hidden">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        </div>
      </div>
    </header>
  );
}
