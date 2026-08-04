"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleCheck,
  CircleX,
  FileClock,
  Fingerprint,
  Landmark,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const roles = [
  {
    eyebrow: "01 · Issuer",
    title: "Register the truth once.",
    body: "Turn verified invoice data into a deterministic, privacy-preserving fingerprint and prove the registry is clean.",
    href: "/issuer",
    cta: "Create invoice proof",
    icon: Fingerprint,
  },
  {
    eyebrow: "02 · Lender",
    title: "Finance with first priority.",
    body: "Inspect a clean receivable, register the first lien, then watch the duplicate financing attempt fail closed.",
    href: "/lender",
    cta: "Open lending desk",
    icon: Landmark,
  },
  {
    eyebrow: "03 · Compliance",
    title: "See every decision.",
    body: "Follow an immutable evidence trail from fingerprint creation through registry checks, financing, and rejection.",
    href: "/compliance",
    cta: "Review audit trail",
    icon: FileClock,
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
      <section className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
        <div className="pointer-events-none absolute top-28 -left-28 size-80 rounded-full border border-emerald-300/25" />
        <div className="pointer-events-none absolute top-40 -left-16 size-52 rounded-full border border-emerald-300/25" />

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
            Cleanverse-native RWA integrity
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="max-w-3xl text-[clamp(3.5rem,8vw,7.3rem)] leading-[0.86] font-semibold tracking-[-0.065em] text-balance"
          >
            One asset.
            <span className="mt-2 block text-emerald-800">
              One first claim.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl"
          >
            Lien stops one real-world invoice from quietly backing multiple
            loans—before minting, before collateralization, before funds move.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/issuer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-5 shadow-[0_12px_32px_-14px_rgba(16,42,38,0.8)]",
              )}
            >
              Run the five-minute demo
              <ArrowRight />
            </Link>
            <Link
              href="/compliance"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 px-5 bg-white/60",
              )}
            >
              Explore the evidence
              <ArrowUpRight />
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
          >
            {[
              "CVI-gated parties",
              "CVA-ready assets",
              "Fail-closed registry",
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
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.75,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative mx-auto w-full max-w-[34rem] lg:mr-0"
        >
          <div className="absolute -inset-8 rounded-[3rem] bg-emerald-200/25 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[#102a26] p-2 shadow-[0_40px_100px_-42px_rgba(9,35,31,0.9)]">
            <div className="rounded-[1.55rem] border border-white/10 bg-[#13322d] p-5 text-white sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-emerald-200/70 uppercase">
                    Live registry proof
                  </p>
                  <p className="mt-1 font-heading text-xl font-semibold">
                    INV-2026-0841
                  </p>
                </div>
                <div className="relative flex size-11 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/20">
                  <ScanSearch className="size-5" />
                  <motion.span
                    className="absolute inset-0 rounded-2xl ring-1 ring-emerald-300/40"
                    animate={
                      reduceMotion
                        ? undefined
                        : { scale: [1, 1.35], opacity: [0.7, 0] }
                    }
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                </div>
              </div>

              <div className="py-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-emerald-300 text-[#102a26]">
                    <CircleCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      First registry check: clean
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-100/55">
                      No active lien found across the registry
                    </p>
                  </div>
                </div>

                <div className="ml-[1.35rem] h-9 border-l border-dashed border-emerald-200/25" />

                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-sky-300/15 text-sky-200 ring-1 ring-sky-200/20">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      Lender A: first lien active
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-100/55">
                      Priority #1 · registry synchronized
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/8 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-300/15 text-rose-200">
                    <CircleX className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">Lender B blocked</p>
                      <span className="rounded-full bg-rose-200/10 px-2 py-0.5 font-mono text-[9px] text-rose-100 ring-1 ring-rose-200/15">
                        FINANCING_BLOCKED
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-rose-100/60">
                      An active first-priority claim already exists on this
                      receivable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-2 -bottom-7 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-xl backdrop-blur sm:-right-8"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Fingerprint className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Fingerprint
              </p>
              <p className="font-mono text-xs font-medium">0x83e4…b7c1</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section className="border-y border-border/70 bg-white/45">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">
                Three desks. One source of truth.
              </p>
              <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-[-0.04em] sm:text-5xl">
                The whole risk decision, in one shared story.
              </h2>
            </div>
            <p className="max-w-2xl self-end text-lg leading-8 text-muted-foreground">
              Each role sees only what it needs, while every action resolves to
              the same fingerprint and auditable first-priority claim.
            </p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <motion.article
                  key={role.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ delay: reduceMotion ? 0 : index * 0.08 }}
                  className="group flex min-h-[22rem] flex-col rounded-[1.75rem] border border-border/75 bg-card/85 p-6 shadow-[0_18px_55px_-42px_rgba(15,23,42,0.5)] transition-transform duration-300 hover:-translate-y-1 sm:p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {role.eyebrow}
                    </span>
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground transition-transform group-hover:rotate-3 group-hover:scale-105">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <h3 className="mt-16 text-2xl font-semibold tracking-[-0.03em]">
                    {role.title}
                  </h3>
                  <p className="mt-3 leading-6 text-muted-foreground">
                    {role.body}
                  </p>
                  <Link
                    href={role.href}
                    className="mt-auto flex items-center gap-2 pt-8 text-sm font-semibold text-emerald-800"
                  >
                    {role.cta}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
