"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  Eye,
  FileSearch,
  Fingerprint,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CopyButton } from "@/components/copy-button";
import { DemoProgress } from "@/components/demo-progress";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssets, useFinanceAsset } from "@/hooks/use-assets";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import type {
  Asset,
  FinanceResult,
  FinancingBlockedPayload,
} from "@/lib/asset-types";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/stores/demo-store";

const fingerprintSchema = z.object({
  fingerprint: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Enter a valid 32-byte fingerprint"),
});

type FingerprintSearch = z.infer<typeof fingerprintSchema>;
type LenderIdentity = "a" | "b";

const lenders = {
  a: {
    short: "Lender A",
    name: "Northstar Capital",
    cvi: "cvi:lender:northstar-capital",
    initials: "NC",
  },
  b: {
    short: "Lender B",
    name: "Meridian Credit",
    cvi: "cvi:lender:meridian-credit",
    initials: "MC",
  },
};

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function LenderPage() {
  const assetsQuery = useAssets();
  const finance = useFinanceAsset();
  const isMobile = useIsMobile();
  const [identity, setIdentity] = useState<LenderIdentity>("a");
  const [drawerFingerprint, setDrawerFingerprint] = useState<string | null>(
    null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [financeResult, setFinanceResult] = useState<FinanceResult | null>(
    null,
  );
  const [blocked, setBlocked] = useState<FinancingBlockedPayload | null>(null);
  const demoFingerprint = useDemoStore((state) => state.fingerprint);
  const selectFingerprint = useDemoStore((state) => state.selectFingerprint);
  const markFinanced = useDemoStore((state) => state.markFinanced);
  const markBlocked = useDemoStore((state) => state.markBlocked);
  const currentLender = lenders[identity];

  const form = useForm<FingerprintSearch>({
    resolver: zodResolver(fingerprintSchema),
    defaultValues: { fingerprint: demoFingerprint ?? "" },
  });

  useEffect(() => {
    if (demoFingerprint) form.setValue("fingerprint", demoFingerprint);
  }, [demoFingerprint, form]);

  const assets = useMemo(() => {
    const items = [...(assetsQuery.data ?? [])];
    return items.sort((a, b) => {
      if (a.fingerprint === demoFingerprint) return -1;
      if (b.fingerprint === demoFingerprint) return 1;
      if (a.isClean !== b.isClean) return a.isClean ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [assetsQuery.data, demoFingerprint]);

  const selected = useMemo(
    () =>
      drawerFingerprint
        ? (assets.find((asset) => asset.fingerprint === drawerFingerprint) ??
          null)
        : null,
    [assets, drawerFingerprint],
  );

  const cleanCount = assets.filter((asset) => asset.isClean).length;
  const protectedCount = assets.filter((asset) => !asset.isClean).length;
  const cleanValue = assets
    .filter((asset) => asset.isClean)
    .reduce((total, asset) => total + Number(asset.fields.amount || 0), 0);

  function openAsset(asset: Asset) {
    setDrawerFingerprint(asset.fingerprint);
    selectFingerprint(asset.fingerprint);
    setFinanceResult(null);
    setBlocked(null);
    setDrawerOpen(true);
  }

  function search(values: FingerprintSearch) {
    const match = assets.find(
      (asset) =>
        asset.fingerprint.toLowerCase() === values.fingerprint.toLowerCase(),
    );
    if (!match) {
      toast.error("Fingerprint not found", {
        description: "Register the invoice in the issuer workspace first.",
      });
      return;
    }
    openAsset(match);
  }

  async function financeSelected() {
    if (!selected) return;
    setFinanceResult(null);
    setBlocked(null);

    try {
      const result = await finance.mutateAsync({
        fingerprint: selected.fingerprint,
        lenderCvi: currentLender.cvi,
        chain: selected.chain ?? "base",
        requireCleanverseVerify: false,
      });
      setFinanceResult(result);
      markFinanced(result.lien.id);
      toast.success("First-priority lien registered", {
        description: `${currentLender.name} now holds priority #1 on ${result.asset.invoiceNumber}.`,
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "FINANCING_BLOCKED"
      ) {
        setBlocked(error.payload as FinancingBlockedPayload);
        markBlocked();
        toast.error("Duplicate financing blocked", {
          description:
            "An active first-priority claim already protects this receivable.",
        });
        return;
      }
      toast.error("Financing request failed", {
        description: getApiErrorMessage(error),
      });
    }
  }

  function switchToLenderB() {
    setIdentity("b");
    setFinanceResult(null);
    setBlocked(null);
    toast.info("Desk switched to Lender B", {
      description:
        "Retry the same fingerprint to demonstrate duplicate protection.",
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <DemoProgress />

      <div className="mt-10 flex flex-col gap-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
                02
              </span>
              Lending desk
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Finance with certainty.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Review verified receivables, register the first claim, and fail
              closed when the same asset appears again.
            </p>
          </div>

          <div className="rounded-2xl border border-border/75 bg-white/70 p-1.5 shadow-sm backdrop-blur">
            <p className="px-2 pb-1.5 pt-1 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Active desk identity
            </p>
            <div className="flex gap-1">
              {(Object.keys(lenders) as LenderIdentity[]).map((key) => {
                const lender = lenders[key];
                const active = identity === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setIdentity(key);
                      setFinanceResult(null);
                      setBlocked(null);
                    }}
                    className={cn(
                      "relative flex min-w-36 items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors",
                      active
                        ? "text-white"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="lender-identity"
                        className="absolute inset-0 rounded-xl bg-[#102a26]"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex size-7 items-center justify-center rounded-lg bg-muted text-[10px] font-bold",
                        active && "bg-white/10 text-white",
                      )}
                    >
                      {lender.initials}
                    </span>
                    <span className="relative">
                      <span className="block text-xs font-semibold">
                        {lender.short}
                      </span>
                      <span
                        className={cn(
                          "block text-[9px]",
                          active ? "text-white/55" : "text-muted-foreground",
                        )}
                      >
                        {lender.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Clean opportunities",
              value: cleanCount.toString(),
              icon: BadgeCheck,
              tone: "text-emerald-700 bg-emerald-100",
            },
            {
              label: "Available face value",
              value: new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(cleanValue),
              icon: CircleDollarSign,
              tone: "text-sky-700 bg-sky-100",
            },
            {
              label: "Protected by first lien",
              value: protectedCount.toString(),
              icon: LockKeyhole,
              tone: "text-violet-700 bg-violet-100",
            },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                size="sm"
                className="border-border/70 bg-card/80"
              >
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">
                      {metric.value}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl",
                      metric.tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border/70 bg-card/88 py-0 shadow-[0_24px_75px_-55px_rgba(15,23,42,0.7)]">
          <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Receivable registry</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clean and financed assets remain visible for conflict testing.
                </p>
              </div>
              <form
                onSubmit={form.handleSubmit(search)}
                className="flex w-full gap-2 lg:max-w-xl"
              >
                <Field className="gap-1.5">
                  <FieldLabel className="sr-only" htmlFor="fingerprint-search">
                    Asset fingerprint
                  </FieldLabel>
                  <div className="relative">
                    <Fingerprint className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fingerprint-search"
                      data-testid="fingerprint-search"
                      className="h-10 pl-9 font-mono text-xs"
                      placeholder="Paste 0x fingerprint"
                      aria-invalid={Boolean(form.formState.errors.fingerprint)}
                      {...form.register("fingerprint")}
                    />
                  </div>
                  <FieldError errors={[form.formState.errors.fingerprint]} />
                </Field>
                <Button
                  type="submit"
                  className="h-10"
                  aria-label="Find fingerprint"
                >
                  <Search />
                  <span className="hidden sm:inline">Find</span>
                </Button>
              </form>
            </div>
          </CardHeader>

          <CardContent className="px-3 py-3 sm:px-5 sm:py-5">
            {assetsQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <Skeleton key={item} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : assetsQuery.isError ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <CircleAlert className="size-8 text-destructive" />
                <p className="mt-3 font-medium">Registry unavailable</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {getApiErrorMessage(assetsQuery.error)}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => assetsQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : assets.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <FileSearch className="size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No receivables yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the first invoice fingerprint in the issuer workspace.
                </p>
                <Link
                  href="/issuer"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
                >
                  Open issuer workspace
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map((asset, index) => (
                  <motion.button
                    key={asset.id}
                    type="button"
                    data-testid={`asset-row-${index}`}
                    onClick={() => openAsset(asset)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.2) }}
                    className={cn(
                      "group grid w-full gap-4 rounded-2xl border border-transparent px-4 py-4 text-left transition-all hover:border-border hover:bg-muted/45 sm:grid-cols-[minmax(0,1.5fr)_minmax(9rem,0.6fr)_minmax(8rem,0.45fr)_auto] sm:items-center sm:px-5",
                      asset.fingerprint === demoFingerprint &&
                        "border-emerald-200 bg-emerald-50/55 hover:border-emerald-300 hover:bg-emerald-50",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-heading text-base font-semibold">
                          {asset.fields.invoiceNumber}
                        </p>
                        {asset.fingerprint === demoFingerprint && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-emerald-700 uppercase">
                            Demo asset
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                        {asset.fingerprint}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">
                        {formatMoney(
                          asset.fields.amount,
                          asset.fields.currency,
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Due {formatDate(asset.fields.dueDate)}
                      </p>
                    </div>
                    <StatusBadge
                      label={asset.isClean ? "Clean" : "First lien active"}
                      tone={asset.isClean ? "clean" : "financed"}
                    />
                    <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground">
                      <Eye className="size-4" />
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        swipeDirection={isMobile ? "down" : "right"}
      >
        <DrawerContent className="sm:[--drawer-content-width:34rem]">
          <DrawerHeader className="border-b border-border px-5 pb-5 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-4 pr-10">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {selected && (
                    <StatusBadge
                      label={
                        selected.isClean
                          ? "Registry clean"
                          : "First lien active"
                      }
                      tone={selected.isClean ? "clean" : "financed"}
                    />
                  )}
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    {currentLender.short}
                  </span>
                </div>
                <DrawerTitle className="text-2xl font-semibold tracking-tight">
                  {selected?.fields.invoiceNumber ?? "Receivable"}
                </DrawerTitle>
                <DrawerDescription className="mt-2">
                  Review the asset evidence before registering a financing
                  claim.
                </DrawerDescription>
              </div>
              <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
                <X />
                <span className="sr-only">Close drawer</span>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {selected && (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <AnimatePresence mode="wait">
                {blocked ? (
                  <motion.div
                    key="blocked"
                    data-testid="financing-blocked"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 overflow-hidden rounded-3xl border border-rose-200 bg-rose-50"
                  >
                    <div className="bg-rose-600 px-5 py-5 text-white">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-2xl bg-white/12">
                          <ShieldAlert className="size-5" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold tracking-[0.13em] text-rose-100 uppercase">
                            Financing rejected
                          </p>
                          <p className="mt-1 font-heading text-xl font-semibold">
                            Duplicate claim blocked
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm leading-6 text-rose-950/75">
                        This receivable already has an active first-priority
                        claim. Lien stopped the second pledge before funds could
                        move.
                      </p>
                      <div className="mt-4 space-y-2 rounded-2xl bg-white/70 p-4 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Reason code
                          </span>
                          <code className="font-semibold text-rose-700">
                            FINANCING_BLOCKED
                          </code>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Existing lender
                          </span>
                          <span className="text-right font-medium">
                            {blocked.existingLien?.lenderCvi ??
                              "First-priority lender"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            Priority
                          </span>
                          <span className="font-medium">
                            #{blocked.existingLien?.priority ?? 1}
                          </span>
                        </div>
                      </div>
                      <Link
                        href="/compliance"
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "mt-4 w-full bg-white/70",
                        )}
                      >
                        View audit evidence
                        <ArrowRight />
                      </Link>
                    </div>
                  </motion.div>
                ) : financeResult ? (
                  <motion.div
                    key="financed"
                    data-testid="financing-success"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                        <Check />
                      </span>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.13em] text-emerald-700 uppercase">
                          Lien registered
                        </p>
                        <h3 className="mt-1 font-heading text-xl font-semibold">
                          First financing secured
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-emerald-950/65">
                          {currentLender.name} now holds the active priority #1
                          claim.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white/65 p-4 font-mono text-[10px] break-all text-muted-foreground">
                      Lien ID · {financeResult.lien.id}
                    </div>
                    <Button
                      data-testid="switch-lender-b"
                      onClick={switchToLenderB}
                      className="mt-4 w-full"
                    >
                      Switch to Lender B & retry
                      <ArrowRight />
                    </Button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <Banknote className="size-4 text-muted-foreground" />
                  <p className="mt-3 text-[10px] font-semibold tracking-[0.11em] text-muted-foreground uppercase">
                    Face value
                  </p>
                  <p className="mt-1 font-heading text-lg font-semibold">
                    {formatMoney(
                      selected.fields.amount,
                      selected.fields.currency,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <Clock3 className="size-4 text-muted-foreground" />
                  <p className="mt-3 text-[10px] font-semibold tracking-[0.11em] text-muted-foreground uppercase">
                    Due date
                  </p>
                  <p className="mt-1 font-heading text-lg font-semibold">
                    {formatDate(selected.fields.dueDate)}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Asset evidence
                </p>
                <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                  {[
                    ["Issuer CVI", selected.fields.issuerCvi],
                    ["Debtor CVI", selected.fields.debtorCvi],
                    ["Network", selected.chain ?? "base"],
                    [
                      "Registry state",
                      selected.isClean
                        ? "No active lien"
                        : "Priority #1 lien active",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="max-w-[65%] text-right font-medium break-words">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-[#102a26] p-4 text-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-[0.12em] text-emerald-200/65 uppercase">
                    Deterministic fingerprint
                  </span>
                  <CopyButton value={selected.fingerprint} />
                </div>
                <p className="mt-3 break-all font-mono text-[11px] leading-5 text-emerald-50/70">
                  {selected.fingerprint}
                </p>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950/70">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-700" />
                <p className="leading-6">
                  Demo mode skips live A-Pass verification because no lender
                  wallet/A-Token was supplied. Cleanverse credentials remain
                  server-side.
                </p>
              </div>
            </div>
          )}

          <DrawerFooter className="border-t border-border bg-card px-5 py-4 sm:px-7">
            {!blocked && !financeResult && selected && (
              <Button
                data-testid="finance-asset"
                size="lg"
                onClick={financeSelected}
                disabled={finance.isPending}
                className={cn(
                  "h-12 w-full",
                  identity === "b" &&
                    "bg-rose-600 text-white hover:bg-rose-700",
                )}
              >
                {finance.isPending ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Checking registry & registering…
                  </>
                ) : identity === "a" ? (
                  <>
                    <Landmark />
                    Finance as Lender A
                  </>
                ) : (
                  <>
                    <ShieldAlert />
                    Attempt same financing as Lender B
                  </>
                )}
              </Button>
            )}
            {blocked && (
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-rose-700">
                <LockKeyhole className="size-4" />
                Funds protected · no second claim created
              </div>
            )}
            {financeResult && (
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
                <Sparkles className="size-4" />
                First-priority claim active
              </div>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
