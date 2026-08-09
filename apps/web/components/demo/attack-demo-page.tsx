"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet, getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LiveParticipantPanel } from "@/components/demo/live-participant-panel";

type LienStatus = {
  enabled: boolean;
  ready: boolean;
  chainId: number;
  trustMode?: string;
  settlementRail?: {
    rail: string;
    labeledMock?: boolean;
    note?: string;
  };
  registry: string | null;
  guard: string | null;
  protocolA: string | null;
  protocolB: string | null;
  settlementToken: string | null;
};

function short(hex?: string | null, n = 10) {
  if (!hex) return "—";
  if (hex.length <= n * 2) return hex;
  return `${hex.slice(0, n)}…${hex.slice(-6)}`;
}

export function AttackDemoPage() {
  const [stack, setStack] = useState<LienStatus | null>(null);

  const refreshStack = useCallback(async () => {
    try {
      setStack(await apiGet<LienStatus>("/lien/status"));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void refreshStack();
  }, [refreshStack]);

  return (
    <div className="relative mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(16,42,38,0.07),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(16,42,38,0.2),transparent_60%)]" />

      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-emerald-900 uppercase shadow-sm dark:border-emerald-400/20 dark:bg-emerald-950/70 dark:text-emerald-100">
            <Sparkles className="size-3.5" />
            Demo control room
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            One obligation.{" "}
            <span className="text-emerald-800 dark:text-emerald-300">
              One active claim.
            </span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-[1.05rem]">
            Live wallets on Sepolia: register, obligor EIP-712 sign, finance
            Protocol A, then watch Protocol B fail before funds move.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full"
          onClick={() => void refreshStack()}
        >
          <RefreshCw className="size-3.5" />
          Refresh stack
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm">
        <Badge
          variant={stack?.ready ? "default" : "secondary"}
          className="h-7 gap-1.5 rounded-full px-3"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              stack?.ready ? "bg-emerald-300" : "bg-muted-foreground",
            )}
          />
          {stack?.ready ? "LienGuard ready" : "Not configured"}
        </Badge>
        <Badge variant="outline" className="h-7 rounded-full px-3 font-normal">
          Trust {stack?.trustMode ?? "—"}
        </Badge>
        <Badge variant="outline" className="h-7 rounded-full px-3 font-normal">
          {stack?.settlementRail?.rail ?? "rail —"}
          {stack?.settlementRail?.labeledMock ? " · mock" : ""}
        </Badge>
        <span className="text-xs text-muted-foreground">
          chain {stack?.chainId ?? "—"} · guard {short(stack?.guard)}
        </span>
      </div>

      <LiveParticipantPanel />

      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <p>
            LIEN provides <strong>protocol-level encumbrance state</strong> for
            integrated systems. Live mode uses real CVI/CCP when configured.
            Settlement rail may be a labeled dUSDC substitute.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
        <ArrowRight className="size-4 text-emerald-800 dark:text-emerald-300" />
        Race-safety covered in contract tests: competing reservations, only one
        succeeds.
      </div>
    </div>
  );
}
