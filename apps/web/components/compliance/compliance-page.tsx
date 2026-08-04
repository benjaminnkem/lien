"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Ban,
  Check,
  CircleAlert,
  ClipboardCheck,
  FileClock,
  FileKey2,
  Fingerprint,
  Landmark,
  ListChecks,
  Search,
  SearchCheck,
  ShieldCheck,
  ShieldX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CopyButton } from "@/components/copy-button";
import { DemoProgress } from "@/components/demo-progress";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
import { useAssets, useAuditEvents } from "@/hooks/use-assets";
import { useIsMobile } from "@/hooks/use-mobile";
import { getApiErrorMessage } from "@/lib/api";
import type { AuditEvent, AuditEventType } from "@/lib/asset-types";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/stores/demo-store";

const searchSchema = z.object({
  fingerprint: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Enter a valid 32-byte fingerprint"),
});

type SearchForm = z.infer<typeof searchSchema>;

const eventMeta: Record<
  AuditEventType,
  {
    label: string;
    description: string;
    icon: typeof Fingerprint;
    iconClass: string;
    ringClass: string;
  }
> = {
  FINGERPRINT_CREATED: {
    label: "Fingerprint created",
    description:
      "Canonical invoice fields were registered as a private asset identity.",
    icon: FileKey2,
    iconClass: "bg-violet-100 text-violet-700",
    ringClass: "ring-violet-200",
  },
  ENCUMBRANCE_CHECKED: {
    label: "Registry checked",
    description:
      "The encumbrance registry was queried for an active priority claim.",
    icon: SearchCheck,
    iconClass: "bg-sky-100 text-sky-700",
    ringClass: "ring-sky-200",
  },
  CVA_MINTED: {
    label: "CVA issued",
    description:
      "Cleanverse issued the verified on-chain asset representation.",
    icon: BadgeCheck,
    iconClass: "bg-amber-100 text-amber-700",
    ringClass: "ring-amber-200",
  },
  LIEN_REGISTERED: {
    label: "First lien registered",
    description:
      "Financing created an active first-priority claim on the receivable.",
    icon: Landmark,
    iconClass: "bg-emerald-100 text-emerald-700",
    ringClass: "ring-emerald-200",
  },
  FINANCING_BLOCKED: {
    label: "Duplicate financing blocked",
    description:
      "A second lender was stopped because the first-priority claim was active.",
    icon: ShieldX,
    iconClass: "bg-rose-100 text-rose-700",
    ringClass: "ring-rose-200",
  },
  CVI_VERIFIED: {
    label: "CVI verified",
    description:
      "Cleanverse confirmed the party's A-Pass transfer eligibility.",
    icon: ShieldCheck,
    iconClass: "bg-teal-100 text-teal-700",
    ringClass: "ring-teal-200",
  },
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function shortFingerprint(value: string | null) {
  if (!value) return "System event";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function CompliancePage() {
  const demoFingerprint = useDemoStore((state) => state.fingerprint);
  const isMobile = useIsMobile();
  const [manualFingerprint, setManualFingerprint] = useState<string | null>(
    null,
  );
  const activeFingerprint =
    manualFingerprint === null
      ? (demoFingerprint ?? undefined)
      : manualFingerprint || undefined;
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auditQuery = useAuditEvents(activeFingerprint);
  const assetsQuery = useAssets();

  const form = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: { fingerprint: demoFingerprint ?? "" },
  });

  useEffect(() => {
    if (!demoFingerprint) return;
    form.setValue("fingerprint", demoFingerprint);
  }, [demoFingerprint, form]);

  const events = useMemo(() => auditQuery.data ?? [], [auditQuery.data]);
  const summary = useMemo(() => {
    const uniqueAssets = new Set(
      events.map((event) => event.fingerprint).filter(Boolean),
    );
    return {
      assets: uniqueAssets.size,
      checks: events.filter((event) => event.type === "ENCUMBRANCE_CHECKED")
        .length,
      liens: events.filter((event) => event.type === "LIEN_REGISTERED").length,
      blocked: events.filter((event) => event.type === "FINANCING_BLOCKED")
        .length,
    };
  }, [events]);

  const hasLien = summary.liens > 0;
  const hasBlock = summary.blocked > 0;

  function filter(values: SearchForm) {
    setManualFingerprint(values.fingerprint.toLowerCase());
    toast.success("Audit trail filtered");
  }

  function clearFilter() {
    setManualFingerprint("");
    form.reset({ fingerprint: "" });
  }

  function openEvent(event: AuditEvent) {
    setSelectedEvent(event);
    setDrawerOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <DemoProgress />

      <div className="mt-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
                03
              </span>
              Compliance evidence
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Every decision, accounted for.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Trace one fingerprint from creation through the first lien and the
              prevented duplicate claim.
            </p>
          </div>

          <form
            onSubmit={form.handleSubmit(filter)}
            className="flex w-full max-w-2xl gap-2"
          >
            <Field className="gap-1.5">
              <FieldLabel className="sr-only" htmlFor="audit-fingerprint">
                Filter by fingerprint
              </FieldLabel>
              <div className="relative">
                <Fingerprint className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="audit-fingerprint"
                  data-testid="audit-fingerprint"
                  className="h-11 bg-white/65 pl-9 font-mono text-xs"
                  placeholder="Filter by 0x fingerprint"
                  aria-invalid={Boolean(form.formState.errors.fingerprint)}
                  {...form.register("fingerprint")}
                />
              </div>
              <FieldError errors={[form.formState.errors.fingerprint]} />
            </Field>
            <Button type="submit" className="h-11">
              <Search />
              <span className="hidden sm:inline">Search</span>
            </Button>
            {activeFingerprint && (
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                onClick={clearFilter}
                aria-label="Clear fingerprint filter"
              >
                <X />
              </Button>
            )}
          </form>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Assets in scope",
              value: summary.assets,
              icon: Fingerprint,
              className: "bg-violet-100 text-violet-700",
            },
            {
              label: "Registry checks",
              value: summary.checks,
              icon: SearchCheck,
              className: "bg-sky-100 text-sky-700",
            },
            {
              label: "First liens",
              value: summary.liens,
              icon: Landmark,
              className: "bg-emerald-100 text-emerald-700",
            },
            {
              label: "Fraud attempts blocked",
              value: summary.blocked,
              icon: Ban,
              className: "bg-rose-100 text-rose-700",
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
                    <p className="mt-1 font-heading text-2xl font-semibold">
                      {metric.value}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl",
                      metric.className,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(hasLien || hasBlock) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-6 grid gap-5 overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-emerald-50/80 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6",
              hasBlock && "border-rose-200 bg-rose-50/80",
            )}
          >
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white",
                hasBlock && "bg-rose-600",
              )}
            >
              {hasBlock ? <ShieldCheck /> : <ClipboardCheck />}
            </span>
            <div>
              <p className="font-heading text-xl font-semibold">
                {hasBlock
                  ? "Control effective: duplicate claim prevented"
                  : "First-priority protection is active"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {hasBlock
                  ? "The same deterministic fingerprint reached financing twice. The second request was rejected and recorded without creating another lien."
                  : "The receivable has one active first-priority claim. Attempt the same financing as Lender B to complete the control test."}
              </p>
            </div>
            <StatusBadge
              label={hasBlock ? "Test passed" : "Lien active"}
              tone={hasBlock ? "blocked" : "clean"}
            />
          </motion.div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.55fr)]">
          <Card className="border-border/70 bg-card/90 py-0 shadow-[0_24px_75px_-55px_rgba(15,23,42,0.7)]">
            <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Audit timeline</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeFingerprint
                      ? "Events scoped to the selected asset fingerprint."
                      : "Most recent registry events across all assets."}
                  </p>
                </div>
                <StatusBadge label={`${events.length} events`} tone="neutral" />
              </div>
            </CardHeader>
            <CardContent className="px-4 py-5 sm:px-7 sm:py-7">
              {auditQuery.isLoading ? (
                <div className="space-y-5">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="flex gap-4">
                      <Skeleton className="size-10 shrink-0 rounded-2xl" />
                      <div className="w-full space-y-2">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : auditQuery.isError ? (
                <div className="flex min-h-60 flex-col items-center justify-center text-center">
                  <CircleAlert className="size-8 text-destructive" />
                  <p className="mt-3 font-medium">Audit service unavailable</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {getApiErrorMessage(auditQuery.error)}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => auditQuery.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : events.length === 0 ? (
                <div className="flex min-h-60 flex-col items-center justify-center text-center">
                  <FileClock className="size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">No evidence found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Run the issuer and lender steps to populate this timeline.
                  </p>
                </div>
              ) : (
                <div>
                  {events.map((event, index) => {
                    const meta = eventMeta[event.type];
                    const Icon = meta.icon;
                    return (
                      <motion.button
                        key={event.id}
                        type="button"
                        data-testid={`audit-event-${event.type}`}
                        onClick={() => openEvent(event)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.035, 0.2) }}
                        className="group relative flex w-full gap-4 pb-7 text-left last:pb-0"
                      >
                        {index < events.length - 1 && (
                          <span className="absolute top-10 bottom-0 left-5 w-px bg-border" />
                        )}
                        <span
                          className={cn(
                            "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-2xl ring-4 ring-card",
                            meta.iconClass,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 rounded-2xl border border-transparent px-1 py-0.5 transition-colors group-hover:border-border group-hover:bg-muted/40 group-hover:px-3 group-hover:py-2">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-heading text-sm font-semibold">
                              {meta.label}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {formatTimestamp(event.createdAt)}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                            {meta.description}
                          </span>
                          <span className="mt-2 block font-mono text-[10px] text-muted-foreground">
                            {shortFingerprint(event.fingerprint)}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="space-y-5">
            <Card className="border-border/70 bg-[#102a26] text-white ring-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.15em] text-emerald-200/65 uppercase">
                      Evidence coverage
                    </p>
                    <CardTitle className="mt-2 text-lg text-white">
                      Control checklist
                    </CardTitle>
                  </div>
                  <ListChecks className="size-5 text-emerald-200" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  [
                    "Asset fingerprint created",
                    events.some(
                      (event) => event.type === "FINGERPRINT_CREATED",
                    ),
                  ],
                  [
                    "Registry cleanliness checked",
                    events.some(
                      (event) => event.type === "ENCUMBRANCE_CHECKED",
                    ),
                  ],
                  ["First-priority lien recorded", hasLien],
                  ["Duplicate financing rejected", hasBlock],
                ].map(([label, done]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/8"
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full bg-white/8 text-white/35",
                        done && "bg-emerald-300 text-[#102a26]",
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-sm text-white/55",
                        done && "text-white",
                      )}
                    >
                      {String(label)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-base">Registry posture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Assets monitored
                  </span>
                  <span className="font-semibold">
                    {assetsQuery.data?.length ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Active protection
                  </span>
                  <StatusBadge
                    label={hasLien ? "Enforced" : "Waiting"}
                    tone={hasLien ? "clean" : "neutral"}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Audit retention</span>
                  <span className="font-semibold">Complete</span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        swipeDirection={isMobile ? "down" : "right"}
      >
        <DrawerContent className="sm:[--drawer-content-width:32rem]">
          <DrawerHeader className="border-b border-border px-5 pb-5 pt-5 sm:px-7">
            <div className="flex items-start justify-between gap-4 pr-10">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Audit event evidence
                </p>
                <DrawerTitle className="mt-2 text-xl font-semibold">
                  {selectedEvent
                    ? eventMeta[selectedEvent.type].label
                    : "Event"}
                </DrawerTitle>
                <DrawerDescription className="mt-2">
                  Recorded by the Lien asset registry.
                </DrawerDescription>
              </div>
              <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
                <X />
                <span className="sr-only">Close drawer</span>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {selectedEvent && (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              {(() => {
                const meta = eventMeta[selectedEvent.type];
                const Icon = meta.icon;
                return (
                  <div
                    className={cn(
                      "rounded-3xl p-5 ring-1",
                      meta.iconClass,
                      meta.ringClass,
                    )}
                  >
                    <Icon className="size-6" />
                    <p className="mt-5 font-heading text-xl font-semibold">
                      {meta.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 opacity-75">
                      {meta.description}
                    </p>
                  </div>
                );
              })()}

              <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold tracking-[0.11em] text-muted-foreground uppercase">
                    Recorded at
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {formatTimestamp(selectedEvent.createdAt)}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold tracking-[0.11em] text-muted-foreground uppercase">
                    Event ID
                  </p>
                  <p className="mt-1 font-mono text-xs break-all">
                    {selectedEvent.id}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-[0.11em] text-muted-foreground uppercase">
                      Asset fingerprint
                    </p>
                    {selectedEvent.fingerprint && (
                      <CopyButton value={selectedEvent.fingerprint} />
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs break-all">
                    {selectedEvent.fingerprint ?? "Not linked"}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Event payload
                </p>
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#102a26] p-4 font-mono text-[11px] leading-5 text-emerald-50/75">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <DrawerFooter className="border-t border-border px-5 py-4 sm:px-7">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
              <ShieldCheck className="size-4" />
              Evidence captured and queryable
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
