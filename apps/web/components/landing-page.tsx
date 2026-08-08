"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Check,
  Fingerprint,
  LockKeyhole,
  Package,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

const pillars = [
  {
    title: "Canonical Obligation ID",
    body: "Economic terms plus obligor EIP-712 confirmation. Not a PDF hash.",
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

const steps = [
  {
    n: "01",
    title: "Canonicalize the claim",
    body: "Supplier, obligor, face value, due date, and refs form the ID. Evidence is stored for audit, not for identity.",
  },
  {
    n: "02",
    title: "Obligor confirms",
    body: "EIP-712 signature, domain-bound to chain and registry. Unilateral registration never becomes financeable alone.",
  },
  {
    n: "03",
    title: "Reserve before funds move",
    body: "Adapters call LienGuard. First exclusive claim activates. The second reverts with a clear reason.",
  },
];

const states = [
  "Verified",
  "Reserved",
  "Encumbered",
  "Discharged",
] as const;

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const splits: SplitText[] = [];

      if (prefersReducedMotion()) {
        gsap.set(
          root.querySelectorAll(
            "[data-hero-reveal], [data-scroll-reveal], [data-passport], [data-step], [data-pillar], [data-state-chip], [data-progress], [data-scroll-fade], [data-compare-left], [data-compare-right], [data-cta-panel]",
          ),
          { clearProps: "all", opacity: 1, y: 0, x: 0, yPercent: 0, scale: 1 },
        );
        const bar = root.querySelector<HTMLElement>("[data-progress]");
        if (bar) gsap.set(bar, { scaleX: 1 });
        return;
      }

      const run = async () => {
        try {
          if (document.fonts?.ready) await document.fonts.ready;
        } catch {
          /* ignore */
        }

        const title = root.querySelector<HTMLElement>("[data-split-title]");
        const sub = root.querySelector<HTMLElement>("[data-split-sub]");
        const heroBits = gsap.utils.toArray<HTMLElement>(
          root.querySelectorAll("[data-hero-reveal]"),
        );
        const passport = root.querySelector<HTMLElement>("[data-passport]");
        const progress = root.querySelector<HTMLElement>("[data-progress]");
        const ambient = root.querySelectorAll("[data-ambient]");
        const heroSection = root.querySelector("[data-hero]");

        gsap.set(heroBits, { opacity: 0, y: 16 });
        if (passport) {
          gsap.set(passport, {
            opacity: 0,
            y: 32,
            clipPath: "inset(10% 6% 10% 6% round 28px)",
          });
        }
        if (progress) {
          gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
        }

        // Page scroll progress bar
        if (progress) {
          gsap.to(progress, {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.35,
            },
          });
        }

        // Ambient parallax blobs
        ambient.forEach((el, i) => {
          gsap.to(el, {
            y: i % 2 === 0 ? -80 : -40,
            x: i % 2 === 0 ? 30 : -20,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        });

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        if (title) {
          const split = SplitText.create(title, {
            type: "lines",
            mask: "lines",
            linesClass: "hero-line",
            aria: "auto",
          });
          splits.push(split);

          if (split.lines[1]) {
            (split.lines[1] as HTMLElement).classList.add(
              "text-emerald-800",
              "dark:text-emerald-300",
            );
          }

          gsap.set(split.lines, { yPercent: 115 });
          tl.to(
            split.lines,
            { yPercent: 0, duration: 0.95, stagger: 0.11 },
            0.05,
          );
        }

        if (sub) {
          const subSplit = SplitText.create(sub, {
            type: "lines",
            mask: "lines",
            aria: "auto",
          });
          splits.push(subSplit);
          gsap.set(subSplit.lines, { yPercent: 110, opacity: 0 });
          tl.to(
            subSplit.lines,
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.72,
              stagger: 0.05,
            },
            "-=0.42",
          );
        }

        tl.to(
          heroBits,
          { y: 0, opacity: 1, duration: 0.6, stagger: 0.06 },
          "-=0.35",
        );

        if (passport) {
          tl.to(
            passport,
            {
              opacity: 1,
              y: 0,
              clipPath: "inset(0% 0% 0% 0% round 28px)",
              duration: 1,
              ease: "power3.out",
            },
            "-=0.7",
          );

          const pulse = passport.querySelectorAll("[data-passport-pulse]");
          if (pulse.length) {
            gsap.fromTo(
              pulse,
              { scale: 0.94, opacity: 0.5 },
              {
                scale: 1,
                opacity: 1,
                duration: 1.15,
                stagger: 0.1,
                ease: "power2.out",
                delay: 0.7,
              },
            );
          }

          // Subtle float while hero is in view (inner shell so intro y stays clean)
          const shell = passport.querySelector<HTMLElement>("[data-passport-shell]");
          if (heroSection && shell) {
            gsap.to(shell, {
              y: -28,
              ease: "none",
              scrollTrigger: {
                trigger: heroSection,
                start: "top top",
                end: "bottom top",
                scrub: 0.5,
              },
            });
          }
        }

        // Section headings: split + mask on scroll
        gsap.utils
          .toArray<HTMLElement>(root.querySelectorAll("[data-split-scroll]"))
          .forEach((el) => {
            const split = SplitText.create(el, {
              type: "lines",
              mask: "lines",
              aria: "auto",
            });
            splits.push(split);
            gsap.set(split.lines, { yPercent: 110 });
            gsap.to(split.lines, {
              yPercent: 0,
              duration: 0.8,
              stagger: 0.07,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 88%",
                once: true,
              },
            });
          });

        // Generic fade-up reveals
        gsap.utils
          .toArray<HTMLElement>(root.querySelectorAll("[data-scroll-reveal]"))
          .forEach((el) => {
            gsap.fromTo(
              el,
              { y: 36, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.78,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 88%",
                  once: true,
                },
              },
            );
          });

        // Compare cards: enter from sides + light scrub settle
        const left = root.querySelector<HTMLElement>("[data-compare-left]");
        const right = root.querySelector<HTMLElement>("[data-compare-right]");
        if (left && right) {
          const compare = root.querySelector("[data-compare]");
          gsap.fromTo(
            left,
            { x: -48, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.85,
              ease: "power3.out",
              scrollTrigger: {
                trigger: compare ?? left,
                start: "top 85%",
                once: true,
              },
            },
          );
          gsap.fromTo(
            right,
            { x: 48, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.85,
              ease: "power3.out",
              scrollTrigger: {
                trigger: compare ?? right,
                start: "top 85%",
                once: true,
              },
            },
          );
        }

        // Steps: clip-path wipe + lift
        gsap.utils
          .toArray<HTMLElement>(root.querySelectorAll("[data-step]"))
          .forEach((el, i) => {
            gsap.fromTo(
              el,
              {
                y: 40,
                opacity: 0,
                clipPath: "inset(12% 8% 12% 8% round 24px)",
              },
              {
                y: 0,
                opacity: 1,
                clipPath: "inset(0% 0% 0% 0% round 24px)",
                duration: 0.85,
                delay: i * 0.07,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 90%",
                  once: true,
                },
              },
            );
          });

        // State machine track: chips + fill bar scrubbed through section
        const stateTrack = root.querySelector<HTMLElement>("[data-state-track]");
        const stateFill = root.querySelector<HTMLElement>("[data-state-fill]");
        if (stateTrack) {
          gsap.fromTo(
            stateTrack.querySelectorAll("[data-state-chip]"),
            { y: 16, opacity: 0, scale: 0.92 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.5,
              stagger: 0.08,
              ease: "power2.out",
              scrollTrigger: {
                trigger: stateTrack,
                start: "top 85%",
                once: true,
              },
            },
          );

          if (stateFill) {
            gsap.fromTo(
              stateFill,
              { scaleX: 0 },
              {
                scaleX: 1,
                ease: "none",
                transformOrigin: "left center",
                scrollTrigger: {
                  trigger: stateTrack,
                  start: "top 80%",
                  end: "bottom 45%",
                  scrub: 0.4,
                },
              },
            );
          }

          // Highlight chips in sequence as the section scrolls
          const chips = gsap.utils.toArray<HTMLElement>(
            stateTrack.querySelectorAll("[data-state-chip]"),
          );
          if (chips.length) {
            ScrollTrigger.create({
              trigger: stateTrack,
              start: "top 75%",
              end: "bottom 40%",
              scrub: 0.3,
              onUpdate: (self) => {
                const active = Math.min(
                  chips.length - 1,
                  Math.floor(self.progress * chips.length),
                );
                chips.forEach((c, idx) => {
                  c.style.opacity = idx <= active ? "1" : "0.5";
                });
              },
            });
          }
        }

        // Pillars: staggered rise with slight rotate
        gsap.utils
          .toArray<HTMLElement>(root.querySelectorAll("[data-pillar]"))
          .forEach((el, i) => {
            gsap.fromTo(
              el,
              { y: 36, opacity: 0, rotate: i === 1 ? 0 : i === 0 ? -1.2 : 1.2 },
              {
                y: 0,
                opacity: 1,
                rotate: 0,
                duration: 0.75,
                delay: i * 0.06,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 92%",
                  once: true,
                },
              },
            );
          });

        // CTA panel: scale + mask scrub into place
        const cta = root.querySelector<HTMLElement>("[data-cta-panel]");
        if (cta) {
          gsap.fromTo(
            cta,
            {
              y: 48,
              opacity: 0.35,
              scale: 0.96,
              clipPath: "inset(6% 4% 6% 4% round 32px)",
            },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              clipPath: "inset(0% 0% 0% 0% round 32px)",
              ease: "none",
              scrollTrigger: {
                trigger: cta,
                start: "top 92%",
                end: "top 48%",
                scrub: 0.45,
              },
            },
          );
        }

        // Soft fade of hero content as you leave
        if (heroSection) {
          const heroCopy = heroSection.querySelector("[data-hero-copy]");
          if (heroCopy) {
            gsap.to(heroCopy, {
              opacity: 0.15,
              y: -24,
              ease: "none",
              scrollTrigger: {
                trigger: heroSection,
                start: "center top",
                end: "bottom top",
                scrub: 0.4,
              },
            });
          }
        }
      };

      void run();

      return () => {
        splits.forEach((s) => {
          try {
            s.revert();
          } catch {
            /* ignore */
          }
        });
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="relative overflow-x-hidden">
      {/* scroll progress */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 right-0 left-0 z-50 h-[2px] bg-transparent"
      >
        <div
          data-progress
          className="h-full origin-left scale-x-0 bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 dark:from-emerald-500 dark:via-emerald-300 dark:to-teal-200"
        />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] overflow-hidden"
      >
        <div
          data-ambient
          className="absolute top-[-10%] left-[-8%] size-[28rem] rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-400/10"
        />
        <div
          data-ambient
          className="absolute top-[8%] right-[-12%] size-[32rem] rounded-full bg-teal-500/10 blur-3xl dark:bg-teal-400/10"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,var(--background)_78%)]" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.2 0.03 168 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.2 0.03 168 / 0.04) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse at 50% 20%, black 0%, transparent 70%)",
          }}
        />
      </div>

      {/* HERO */}
      <section
        data-hero
        className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-20"
      >
        <div data-hero-copy className="relative z-10 min-w-0">
          <div
            data-hero-reveal
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-emerald-900 uppercase shadow-sm backdrop-blur-sm dark:border-emerald-400/20 dark:bg-emerald-950/70 dark:text-emerald-100"
          >
            <Sparkles className="size-3.5 text-emerald-700 dark:text-emerald-300" />
            Cleanverse · RWA encumbrance
          </div>

          <h1
            data-split-title
            className="max-w-[11ch] text-[clamp(2.85rem,7.2vw,5.75rem)] leading-[0.92] font-semibold tracking-[-0.055em]"
          >
            One obligation.
            <br />
            One active claim.
          </h1>

          <p
            data-split-sub
            className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-[1.2rem] sm:leading-9"
          >
            Blockchains prevent double-spending of tokens.{" "}
            <strong className="font-semibold text-foreground">
              LIEN prevents double-spending of the real-world asset underneath
              them.
            </strong>
          </p>

          <div
            data-hero-reveal
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/demo"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full px-6 text-[15px] shadow-[0_16px_40px_-16px_rgba(16,42,38,0.85)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.65)]",
              )}
            >
              Run the attack demo
              <ArrowRight className="transition-transform group-hover/button:translate-x-0.5" />
            </Link>
            <a
              href="https://www.npmjs.com/package/lien-sdk"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 rounded-full px-5 text-[15px]",
              )}
            >
              <Package className="size-4" />
              lien-sdk on npm
            </a>
          </div>

          <ul
            data-hero-reveal
            className="mt-11 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
          >
            {["CVI + CCP gates", "Atomic LienClearance", "Protocol A vs B"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-400/25">
                    <Check className="size-3 stroke-[2.5]" />
                  </span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <div
          data-passport
          className="relative mx-auto w-full max-w-md will-change-transform lg:max-w-none"
        >
          <div
            data-passport-shell
            className="relative will-change-transform"
          >
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-400/20 via-transparent to-teal-500/10 blur-xl dark:from-emerald-400/15" />
          <div className="overflow-hidden rounded-[1.75rem] border border-emerald-950/10 bg-[#0c221f] text-white shadow-[0_40px_80px_-32px_rgba(12,34,31,0.75)] ring-1 ring-white/10 dark:border-emerald-400/15 dark:shadow-[0_40px_80px_-32px_rgba(0,0,0,0.75)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-200/80 uppercase">
                  Obligation passport
                </p>
                <p className="mt-1 font-heading text-lg font-semibold tracking-tight">
                  Acme Ltd → Atlas Corp
                </p>
              </div>
              <span
                data-passport-pulse
                className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100"
              >
                Encumbered
              </span>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] tracking-wider text-emerald-100/55 uppercase">
                    Face value
                  </p>
                  <p className="mt-1 font-medium tabular-nums">USD 100,000</p>
                </div>
                <div className="rounded-2xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
                  <p className="text-[10px] tracking-wider text-emerald-100/55 uppercase">
                    Invoice
                  </p>
                  <p className="mt-1 font-mono text-[13px]">INV-ACME-100</p>
                </div>
              </div>

              <div className="rounded-2xl bg-black/25 px-3.5 py-3 ring-1 ring-white/10">
                <p className="text-[10px] tracking-wider text-emerald-100/55 uppercase">
                  Obligation ID
                </p>
                <p className="mt-1 truncate font-mono text-xs text-emerald-50/90">
                  0x7a3f…c91e · same ID for Doc A and Doc B
                </p>
              </div>

              <div className="space-y-2">
                <div
                  data-passport-pulse
                  className="flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2.5 text-sm"
                >
                  <span className="font-medium text-emerald-50">
                    Protocol A
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-emerald-200 uppercase">
                    Funded
                  </span>
                </div>
                <div
                  data-passport-pulse
                  className="flex items-center justify-between rounded-xl border border-rose-400/20 bg-rose-500/10 px-3.5 py-2.5 text-sm"
                >
                  <span className="font-medium text-rose-50">Protocol B</span>
                  <span className="text-xs font-semibold tracking-wide text-rose-200 uppercase">
                    Blocked
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-emerald-100/55">
                Exclusive claim held before settlement. Second adapter reverts
                with zero fund movement.
              </p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="relative border-t border-border/60 bg-card/40 dark:bg-card/25">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p
              data-scroll-reveal
              className="text-[11px] font-semibold tracking-[0.16em] text-emerald-800 uppercase dark:text-emerald-300"
            >
              The failure mode
            </p>
            <h2
              data-split-scroll
              className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              File hashes do not stop double financing.
            </h2>
            <p
              data-scroll-reveal
              className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8"
            >
              Change a margin or metadata and the PDF hash changes. The economic
              claim stays the same. Siloed apps each think they are first.
            </p>
          </div>

          <div data-compare className="mt-12 grid gap-4 md:grid-cols-2">
            <div
              data-compare-left
              className="rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm sm:p-7 dark:bg-background/50"
            >
              <p className="text-[11px] font-semibold tracking-[0.14em] text-rose-700/80 uppercase dark:text-rose-300/90">
                Document identity
              </p>
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                Doc A · hash 0x91ab…
              </p>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                Doc B · hash 0x44c2…
              </p>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Looks like two assets. Finances the same receivable twice if
                nothing coordinates the claim.
              </p>
            </div>
            <div
              data-compare-right
              className="rounded-3xl border border-emerald-200/80 bg-emerald-50/50 p-6 shadow-sm ring-1 ring-emerald-900/5 sm:p-7 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:ring-emerald-400/10"
            >
              <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-800 uppercase dark:text-emerald-300">
                Economic identity
              </p>
              <p className="mt-3 font-mono text-sm text-emerald-950/80 dark:text-emerald-100/80">
                Obligation ID 0x7a3f…c91e
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Doc A and Doc B collapse to one ID
              </p>
              <p className="mt-5 text-sm leading-6 text-emerald-950/70 dark:text-emerald-100/65">
                LIEN keys the claim on verified terms. Evidence roots stay for
                audit. Identity does not fork with the file.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p
              data-scroll-reveal
              className="text-[11px] font-semibold tracking-[0.16em] text-emerald-800 uppercase dark:text-emerald-300"
            >
              How LIEN works
            </p>
            <h2
              data-split-scroll
              className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Identity. Confirmation. Exclusive reserve.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.n}
                data-step
                className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-6 shadow-sm transition-colors hover:border-emerald-300/60 sm:p-7 dark:bg-card/60 dark:hover:border-emerald-400/30"
              >
                <div className="absolute -top-10 -right-10 size-28 rounded-full bg-emerald-400/10 blur-2xl transition-opacity group-hover:opacity-100" />
                <p className="font-mono text-xs font-semibold tracking-[0.18em] text-emerald-800/70 dark:text-emerald-300/80">
                  {step.n}
                </p>
                <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {step.body}
                </p>
              </article>
            ))}
          </div>

          <div
            data-state-track
            className="relative mt-10 overflow-x-auto rounded-3xl border border-border/70 bg-[#0c221f] px-5 py-6 text-white shadow-[0_24px_60px_-36px_rgba(12,34,31,0.8)] sm:px-8 dark:border-emerald-400/15"
          >
            <p className="text-[11px] font-semibold tracking-[0.16em] text-emerald-200/70 uppercase">
              LienGuard state machine
            </p>
            <div className="relative mt-5">
              <div
                aria-hidden
                className="absolute top-1/2 right-2 left-2 h-px -translate-y-1/2 bg-white/10"
              />
              <div
                aria-hidden
                data-state-fill
                className="absolute top-1/2 left-2 h-0.5 w-[calc(100%-1rem)] origin-left -translate-y-1/2 scale-x-0 bg-gradient-to-r from-emerald-400 to-teal-300"
              />
              <div className="relative flex min-w-[28rem] items-center justify-between gap-2 sm:gap-3">
                {states.map((state) => (
                  <span
                    key={state}
                    data-state-chip
                    className={cn(
                      "rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide sm:text-sm",
                      state === "Encumbered"
                        ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/30"
                        : "bg-white/8 text-emerald-50 ring-1 ring-white/10",
                    )}
                  >
                    {state}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-emerald-100/55">
              Illegal transitions revert. Discharge keeps claim history. Expired
              reservations return capacity without silent double funding.
            </p>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="border-t border-border/60 bg-card/35 dark:bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p
                data-scroll-reveal
                className="text-[11px] font-semibold tracking-[0.16em] text-emerald-800 uppercase dark:text-emerald-300"
              >
                Why builders integrate
              </p>
              <h2
                data-split-scroll
                className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                A control plane, not another silo.
              </h2>
            </div>
            <p
              data-scroll-reveal
              className="max-w-sm text-sm leading-6 text-muted-foreground"
            >
              Protocol-level encumbrance for systems that call LienGuard. Not a
              claim of universal legal lien perfection.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  data-pillar
                  className="rounded-3xl border border-border/70 bg-background/90 p-6 shadow-sm sm:p-7 dark:bg-background/40"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-400/25">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-heading text-lg font-semibold tracking-tight">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div
            data-cta-panel
            className="relative overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[linear-gradient(135deg,#0c221f_0%,#133e37_48%,#1a4f45_100%)] px-6 py-12 text-white shadow-[0_40px_80px_-40px_rgba(12,34,31,0.9)] sm:px-12 sm:py-14 dark:border-emerald-400/15 dark:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.85)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 right-0 size-64 rounded-full bg-emerald-300/15 blur-3xl"
            />
            <div className="relative max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-emerald-200/80 uppercase">
                See it fail safely
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Watch Protocol B get blocked before funds move.
              </h2>
              <p className="mt-4 text-base leading-7 text-emerald-50/75 sm:text-lg">
                Live Sepolia wallets or a one-click operator seed. Same
                Obligation ID. Same exclusive claim story.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 rounded-full bg-white px-6 text-[15px] text-emerald-950 hover:bg-emerald-50",
                  )}
                >
                  Open the demo
                  <ArrowRight />
                </Link>
                <a
                  href="https://www.npmjs.com/package/lien-sdk"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-12 rounded-full border-white/20 bg-white/5 px-5 text-[15px] text-white hover:bg-white/10 hover:text-white",
                  )}
                >
                  npm i lien-sdk
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
