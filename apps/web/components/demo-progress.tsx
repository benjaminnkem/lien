"use client";

import { Check, FileKey2, Landmark, SearchCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDemoStore, type DemoStage } from "@/stores/demo-store";
import { cn } from "@/lib/utils";

const stageIndex: Record<DemoStage, number> = {
  ready: 0,
  fingerprinted: 1,
  clean: 2,
  financed: 3,
  blocked: 4,
};

const steps = [
  { label: "Fingerprint", href: "/issuer", icon: FileKey2 },
  { label: "Registry clean", href: "/issuer", icon: SearchCheck },
  { label: "First lien", href: "/lender", icon: Landmark },
  { label: "Duplicate blocked", href: "/compliance", icon: ShieldX },
];

export function DemoProgress() {
  const stage = useDemoStore((state) => state.stage);
  const current = stageIndex[stage];

  return (
    <div className="pb-2">
      <div className="relative flex min-w-0 items-center rounded-2xl border border-border/70 bg-white/80 p-2 shadow-[0_16px_50px_-38px_rgba(15,23,42,0.45)] [--progress-inset:3.5rem] backdrop-blur dark:bg-card/80 sm:min-w-[640px] sm:[--progress-inset:5rem]">
        <div className="absolute top-1/2 right-7 left-7 h-px -translate-y-1/2 bg-border sm:right-10 sm:left-10" />
        <motion.div
          className="absolute top-1/2 left-7 h-px -translate-y-1/2 bg-emerald-500 sm:left-10"
          initial={false}
          animate={{
            width: `calc((100% - var(--progress-inset)) * ${Math.max(0, current - 1)} / 3)`,
          }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        {steps.map((step, index) => {
          const position = index + 1;
          const complete = current >= position;
          const active = current === position || (current === 0 && index === 0);
          const Icon = step.icon;

          return (
            <Link
              key={step.label}
              href={step.href}
              aria-label={step.label}
              className="relative z-10 flex flex-1 items-center justify-center gap-0 rounded-xl px-1 py-2.5 text-sm font-medium sm:gap-2 sm:px-3"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border bg-background transition-colors",
                  complete && "border-emerald-600 bg-emerald-600 text-white",
                  active && !complete && "border-primary text-primary",
                )}
              >
                {complete ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </span>
              <span
                className={cn(
                  "hidden bg-white/90 px-1 text-muted-foreground dark:bg-card/90 sm:inline",
                  (active || complete) && "text-foreground",
                )}
              >
                {step.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
