"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Fingerprint,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pillars = [
  {
    title: "Canonical Obligation ID",
    body: "Economic terms + obligor EIP-712 confirmation — not a PDF hash.",
    icon: Fingerprint,
  },
  {
    title: "Atomic reservation",
    body: "Protocol-bound one-time clearance. Only one exclusive claim wins.",
    icon: LockKeyhole,
  },
  {
    title: "Cross-protocol block",
    body: "Independent Protocol B fails on-chain before settlement funds move.",
    icon: ShieldAlert,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function LandingPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="overflow-hidden">
      <section className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-20">
        <div className="pointer-events-none absolute top-28 -left-28 size-80 rounded-full border border-emerald-300/25" />

        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: reduceMotion ? 0 : 0.09 }}
          className="relative z-10"
        >
          <motion.div
            variants={fadeUp}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-emerald-800 uppercase shadow-sm"
          >
            <Sparkles className="size-3.5" />
            Cleanverse · encumbrance infrastructure
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="max-w-3xl text-[clamp(3.2rem,7vw,6.5rem)] leading-[0.9] font-semibold tracking-[-0.06em] text-balance"
          >
            One obligation.
            <span className="mt-2 block text-emerald-800">
              One active claim.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl"
          >
            Blockchains prevent double-spending of tokens.{" "}
            <strong className="font-semibold text-foreground">
              LIEN prevents double-spending of the real-world asset underneath
              them.
            </strong>
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-5 shadow-[0_12px_32px_-14px_rgba(16,42,38,0.8)]",
              )}
            >
              Run the attack demo
              <ArrowRight />
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
          >
            {[
              "CVI + CCP gates",
              "Atomic LienClearance",
              "Protocol A vs B",
            ].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3" />
                </span>
                {item}
              </span>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.6 }}
          className="grid gap-3"
        >
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-heading text-base font-semibold">
                      {p.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="px-1 text-xs text-muted-foreground">
            Protocol-level encumbrance coordination for integrated systems — not
            a claim of universal legal lien perfection.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
