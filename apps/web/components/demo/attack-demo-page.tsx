"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Fingerprint,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Unlock,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost, getApiErrorMessage, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LiveParticipantPanel } from "@/components/demo/live-participant-panel";

type GraphNode = {
  id: string;
  kind: string;
  label: string;
  outcome: string;
  reasonCode?: string | null;
  at?: string;
};

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

type Gate = {
  address: string;
  role: string;
  source: string;
  labeledMock: boolean;
  cvi: { eligible: boolean; message: string };
  ccp: { allowed: boolean; message: string };
};

type SeedResult = {
  demo: {
    supplierName: string;
    obligorName: string;
    supplier: string;
    obligor: string;
    borrower: string;
    invoiceReference: string;
    purchaseOrderReference: string;
    faceValue: string;
    faceValueDisplay: string;
    financeAmount: string;
    financeAmountDisplay: string;
    documentA: string;
    documentB: string;
    dueDate: number;
  };
  obligationId: string;
  registerTx: string;
  confirmTx: string;
  identityChecksHash?: string;
  trustMode?: string;
  gates?: Gate[];
  settlementRail?: LienStatus["settlementRail"];
  preview: {
    evidenceHashA: string;
    evidenceHashB: string | null;
    obligationId: string;
    differentEvidence: boolean;
    sameObligationId: boolean;
    note: string;
  };
  status: {
    state: number;
    stateLabel: string;
    claimController: string;
    securedAmount: string;
    reservedUntil: number;
    financingRef: string;
    repaymentRef: string;
  };
};

type FinanceResult = {
  success: boolean;
  protocol: "A" | "B";
  txHash?: string;
  message?: string;
  reasonCode?: string;
  error?: string;
  identityChecksHash?: string;
  settlementRail?: LienStatus["settlementRail"];
  gates?: Gate[];
  liquidityBefore?: string | null;
  liquidityAfter?: string | null;
  fundsMoved?: boolean | null;
  clearance?: Record<string, unknown>;
  obligation?: { status: SeedResult["status"] };
};

type AuditEvent = {
  id: string;
  eventType: string;
  outcome: string;
  reasonCode?: string | null;
  createdAt: string;
  payload?: Record<string, unknown>;
};

function short(hex?: string | null, n = 10) {
  if (!hex) return "—";
  if (hex.length <= n * 2) return hex;
  return `${hex.slice(0, n)}…${hex.slice(-6)}`;
}

function stateTone(label?: string) {
  const s = (label ?? "").toLowerCase();
  if (s.includes("encumbered"))
    return "bg-amber-100 text-amber-900 border-amber-200";
  if (s.includes("verified"))
    return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (s.includes("discharged"))
    return "bg-sky-100 text-sky-900 border-sky-200";
  if (s.includes("reserved"))
    return "bg-violet-100 text-violet-900 border-violet-200";
  return "bg-muted text-muted-foreground border-border";
}

export function AttackDemoPage() {
  const [stack, setStack] = useState<LienStatus | null>(null);
  const [seed, setSeed] = useState<SeedResult | null>(null);
  const [status, setStatus] = useState<SeedResult["status"] | null>(null);
  const [financeA, setFinanceA] = useState<FinanceResult | null>(null);
  const [financeB, setFinanceB] = useState<FinanceResult | null>(null);
  const [repay, setRepay] = useState<FinanceResult | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [graph, setGraph] = useState<GraphNode[]>([]);
  const [complianceDemo, setComplianceDemo] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [expiryDemo, setExpiryDemo] = useState<Record<string, unknown> | null>(
    null,
  );
  const [subordinate, setSubordinate] = useState<Record<string, unknown> | null>(
    null,
  );
  const [xchain, setXchain] = useState<Record<string, unknown> | null>(null);
  const [attestations, setAttestations] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);

  const refreshStack = useCallback(async () => {
    try {
      setStack(await apiGet<LienStatus>("/lien/status"));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }, []);

  const refreshAudit = useCallback(async (oid?: string) => {
    if (!oid) return;
    try {
      const [rows, g] = await Promise.all([
        apiGet<AuditEvent[]>(
          `/lien/audit?obligationId=${encodeURIComponent(oid)}`,
        ),
        apiGet<{ nodes: GraphNode[] }>(
          `/lien/obligations/${oid}/graph`,
        ).catch(() => ({ nodes: [] as GraphNode[] })),
      ]);
      setAudit(rows);
      setGraph(g.nodes ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void refreshStack();
  }, [refreshStack]);

  const obligationId = seed?.obligationId;

  const onSeed = async () => {
    setBusy("seed");
    try {
      const res = await apiPost<SeedResult, Record<string, never>>(
        "/lien/demo/seed",
        {},
      );
      setSeed(res);
      setStatus(res.status);
      setFinanceA(null);
      setFinanceB(null);
      setRepay(null);
      setComplianceDemo(null);
      setExpiryDemo(null);
      await refreshAudit(res.obligationId);
      toast.success("Verified obligation seeded (CVI/CCP gates applied)");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onFinanceA = async () => {
    if (!seed) return;
    setBusy("financeA");
    try {
      const res = await apiPost<FinanceResult, Record<string, unknown>>(
        "/lien/protocols/A/finance",
        {
          obligationId: seed.obligationId,
          borrower: seed.demo.borrower,
          amount: seed.demo.financeAmount,
        },
      );
      setFinanceA(res);
      if (res.obligation?.status) setStatus(res.obligation.status);
      await refreshAudit(seed.obligationId);
      if (res.success) toast.success("Protocol A encumbrance active");
      else toast.error(res.message ?? "Protocol A failed");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onFinanceB = async () => {
    if (!seed) return;
    setBusy("financeB");
    try {
      const res = await apiPost<FinanceResult, Record<string, unknown>>(
        "/lien/protocols/B/finance",
        {
          obligationId: seed.obligationId,
          borrower: seed.demo.borrower,
          amount: seed.demo.financeAmount,
        },
      );
      setFinanceB(res);
      if (res.obligation?.status) setStatus(res.obligation.status);
      await refreshAudit(seed.obligationId);
      if (!res.success)
        toast.message("Duplicate financing blocked before funds moved");
      else toast.error("Unexpected: Protocol B should have been blocked");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onDischarge = async () => {
    if (!seed) return;
    setBusy("repay");
    try {
      const res = await apiPost<FinanceResult, Record<string, unknown>>(
        "/lien/protocols/A/repay",
        {
          obligationId: seed.obligationId,
          amount: seed.demo.financeAmount,
        },
      );
      setRepay(res);
      if (res.obligation?.status) setStatus(res.obligation.status);
      await refreshAudit(seed.obligationId);
      if (res.success) toast.success("Encumbrance discharged");
      else toast.error(res.message ?? "Repay failed");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const exportPack = (format: "json" | "csv" = "json") => {
    if (!obligationId) return;
    window.open(
      `${API_BASE}/lien/obligations/${obligationId}/export?format=${format}`,
      "_blank",
    );
  };

  const onComplianceFail = async () => {
    if (!seed) return;
    setBusy("compliance");
    try {
      const res = await apiPost<Record<string, unknown>, Record<string, unknown>>(
        "/lien/demo/compliance-fail",
        {
          obligationId: seed.obligationId,
          borrower: seed.demo.borrower,
          protocol: "B",
        },
      );
      setComplianceDemo(res);
      await refreshAudit(seed.obligationId);
      toast.message("Compliance gate blocked financing before funds moved");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onExpiryDemo = async () => {
    if (!seed) return;
    if (financeA?.success && !repay?.success) {
      toast.error("Discharge first — expiry demo needs a free Verified claim");
      return;
    }
    setBusy("expiry");
    try {
      const res = await apiPost<Record<string, unknown>, Record<string, unknown>>(
        "/lien/demo/reservation-expiry",
        {
          obligationId: seed.obligationId,
          amount: seed.demo.financeAmount,
          ttlSeconds: 3,
        },
      );
      setExpiryDemo(res);
      if (res.afterState && typeof res.afterState === "object") {
        setStatus(res.afterState as SeedResult["status"]);
      }
      await refreshAudit(seed.obligationId);
      toast.success("Reservation expired → Verified again");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onSubordinate = async () => {
    if (!seed) return;
    setBusy("subordinate");
    try {
      const res = await apiPost<Record<string, unknown>, Record<string, unknown>>(
        `/lien/obligations/${seed.obligationId}/claims/subordinate`,
        {
          priorityRank: 1,
          amount: "20000000000",
          label: "disclosed-junior-mezz",
        },
      );
      setSubordinate(res);
      await refreshAudit(seed.obligationId);
      toast.success("Subordinate claim registered (protocol-level only)");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onXchain = async () => {
    if (!seed) return;
    setBusy("xchain");
    try {
      const posted = await apiPost<
        Record<string, unknown>,
        Record<string, unknown>
      >("/lien/xchain/post", {
        obligationId: seed.obligationId,
        targetChainId: 10142,
      });
      let consumed: Record<string, unknown> | null = null;
      if (posted.recordId) {
        consumed = await apiPost<
          Record<string, unknown>,
          Record<string, unknown>
        >("/lien/xchain/consume", {
          recordId: posted.recordId,
          obligationId: seed.obligationId,
        });
      }
      setXchain({ posted, consumed });
      await refreshAudit(seed.obligationId);
      toast.message("Cross-chain mock: posted + consumed (not a bridge)");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onAttestations = async () => {
    if (!seed) return;
    setBusy("attest");
    try {
      const res = await apiPost<Record<string, unknown>, Record<string, unknown>>(
        "/lien/attestations/build",
        {
          obligationId: seed.obligationId,
          supplier: seed.demo.supplier,
          invoiceReference: seed.demo.invoiceReference,
          evidenceContent: seed.demo.documentA,
          assetClass: "invoice",
          gates: seed.gates,
          crossChain: xchain?.posted
            ? {
                obligationId: seed.obligationId,
                sourceChainId: String(
                  (xchain.posted as { sourceChainId?: number }).sourceChainId ??
                    "",
                ),
                targetChainId: "10142",
                clearanceHash: String(
                  (xchain.posted as { clearanceHash?: string }).clearanceHash ??
                    "",
                ),
              }
            : undefined,
        },
      );
      setAttestations(res);
      toast.success("Attestation bundle built");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onAnalytics = async () => {
    setBusy("analytics");
    try {
      setAnalytics(await apiGet<Record<string, unknown>>("/lien/analytics"));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const stateLabel = status?.stateLabel ?? "Unregistered";
  const encumbered = (status?.state ?? 0) === 3;
  const discharged = (status?.state ?? 0) === 4;

  const claimGraph = useMemo(
    () => [
      { label: "Verified obligation", done: Boolean(seed) },
      { label: "Protocol A encumbered", done: Boolean(financeA?.success) },
      {
        label: "Protocol B blocked",
        done: Boolean(financeB && !financeB.success),
      },
      { label: "Discharged", done: Boolean(repay?.success) || discharged },
    ],
    [seed, financeA, financeB, repay, discharged],
  );

  const gates = seed?.gates ?? financeA?.gates ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-emerald-900 uppercase">
            <Sparkles className="size-3.5" />
            Live wallets + operator demo
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Obligation passport + dual-protocol attack
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Participants connect wallets on testnet for real register / sign /
            finance txs. Operator seed tools below remain for local Hardhat
            rehearsals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshStack()}>
            <RefreshCw className="size-3.5" />
            Stack
          </Button>
          {obligationId && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPack("json")}
              >
                <Download className="size-3.5" />
                Export JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPack("csv")}
              >
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
          <Badge variant={stack?.ready ? "default" : "secondary"}>
            {stack?.ready ? "LienGuard ready" : "Not configured"}
          </Badge>
          <Badge variant="outline">trust: {stack?.trustMode ?? "—"}</Badge>
          <Badge variant="outline">
            rail: {stack?.settlementRail?.rail ?? "—"}
            {stack?.settlementRail?.labeledMock ? " (mock)" : ""}
          </Badge>
          <span className="text-muted-foreground">
            chain {stack?.chainId ?? "—"} · guard {short(stack?.guard)}
          </span>
        </CardContent>
      </Card>

      <LiveParticipantPanel />

      <div className="border-t border-border/60 pt-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Operator demo (API seed · local Hardhat)
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Deterministic seed with server key for rehearsals. Prefer live
          participant mode above for real wallets on Sepolia.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {claimGraph.map((step, i) => (
          <div
            key={step.label}
            className={cn(
              "rounded-xl border px-3 py-3 text-sm",
              step.done
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
                : "border-border/70 bg-muted/30 text-muted-foreground",
            )}
          >
            <div className="text-[10px] font-semibold tracking-wider uppercase opacity-70">
              Step {i + 1}
            </div>
            <div className="mt-1 font-medium">{step.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
          <CardHeader className="rounded-none border-b bg-gradient-to-br from-[#102a26] to-[#1a3f38] py-6 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-emerald-200/90 uppercase">
                  Obligation passport
                </p>
                <CardTitle className="mt-1 text-xl text-white">
                  {seed?.demo.supplierName ?? "Acme Ltd"} →{" "}
                  {seed?.demo.obligorName ?? "Atlas Corp"}
                </CardTitle>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                  stateTone(stateLabel),
                )}
              >
                {stateLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 py-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Invoice ref"
                value={seed?.demo.invoiceReference ?? "INV-ACME-100"}
              />
              <Field
                label="Face value"
                value={seed?.demo.faceValueDisplay ?? "USD 100,000"}
              />
              <Field
                label="Supplier"
                value={short(seed?.demo.supplier, 8)}
                mono
              />
              <Field
                label="Obligor"
                value={short(seed?.demo.obligor, 8)}
                mono
              />
              <Field
                label="Secured"
                value={
                  status
                    ? `${Number(status.securedAmount) / 1e6 || 0} dUSDC`
                    : "—"
                }
              />
              <Field
                label="Identity checks"
                value={short(seed?.identityChecksHash, 8)}
                mono
              />
            </dl>

            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/25 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Fingerprint className="size-3.5" />
                Canonical Obligation ID
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-xs sm:text-sm">
                  {seed?.obligationId ?? "Seed to derive ID"}
                </code>
                {seed?.obligationId && <CopyButton value={seed.obligationId} />}
              </div>
            </div>

            {seed && (
              <div className="grid gap-3 sm:grid-cols-2">
                <DocCard
                  title="Document A"
                  hash={seed.preview.evidenceHashA}
                  body={seed.demo.documentA}
                />
                <DocCard
                  title="Document B (modified binary)"
                  hash={seed.preview.evidenceHashB ?? "—"}
                  body={seed.demo.documentB}
                  highlight
                />
              </div>
            )}

            {seed && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-950">
                <div className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <strong>Evidence hashes differ</strong>
                    {seed.preview.differentEvidence ? " ✓" : " ✗"} ·{" "}
                    <strong>Obligation IDs match</strong>
                    {seed.preview.sameObligationId ? " ✓" : " ✗"}
                    <p className="mt-1 text-emerald-900/80">
                      {seed.preview.note}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {gates.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border/70 p-4">
                <div className="text-sm font-medium">Trust gates (CVI + CCP)</div>
                {gates.map((g) => (
                  <div
                    key={`${g.role}-${g.address}`}
                    className="rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div className="font-semibold uppercase tracking-wide">
                      {g.role}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {g.source}
                        {g.labeledMock ? " · LABELED MOCK" : ""}
                      </span>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      CVI: {g.cvi.eligible ? "pass" : "fail"} — {g.cvi.message}
                      <br />
                      CCP: {g.ccp.allowed ? "pass" : "fail"} — {g.ccp.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              disabled={busy === "seed" || !stack?.ready}
              onClick={() => void onSeed()}
            >
              {busy === "seed" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              1 · Seed verified obligation
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ProtocolCard
              title="Protocol A"
              subtitle="DemoFinanceA · independent"
              icon={Landmark}
              accent="emerald"
              disabled={!seed || busy !== null || encumbered || discharged}
              loading={busy === "financeA"}
              cta="2 · Finance"
              onAction={() => void onFinanceA()}
              result={
                financeA?.success ? (
                  <ResultOk
                    title="FUNDED + ENCUMBERED"
                    detail={`Tx ${short(financeA.txHash)} · clearance consumed`}
                  />
                ) : financeA && !financeA.success ? (
                  <ResultFail
                    title="Failed"
                    detail={financeA.message ?? financeA.error ?? ""}
                  />
                ) : null
              }
            />
            <ProtocolCard
              title="Protocol B"
              subtitle="DemoFinanceB · same claim"
              icon={ShieldAlert}
              accent="rose"
              disabled={!seed || !financeA?.success || busy !== null}
              loading={busy === "financeB"}
              cta="3 · Attack duplicate"
              onAction={() => void onFinanceB()}
              result={
                financeB && !financeB.success ? (
                  <div className="space-y-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-950">
                    <div className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
                      <Ban className="size-4" />
                      Blocked before funds moved
                    </div>
                    <p className="text-xs font-semibold">
                      {financeB.reasonCode ?? "ASSET_ALREADY_ENCUMBERED"}
                    </p>
                    <p className="text-xs opacity-90">
                      Liquidity before/after: {financeB.liquidityBefore ?? "—"} /{" "}
                      {financeB.liquidityAfter ?? "—"}
                      <br />
                      Funds moved:{" "}
                      <strong>
                        {financeB.fundsMoved === false
                          ? "NO (0)"
                          : String(financeB.fundsMoved)}
                      </strong>
                    </p>
                  </div>
                ) : null
              }
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Unlock className="size-4" />
                Discharge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                ENCUMBERED → DISCHARGED. History retained in audit + on-chain
                refs.
              </p>
              <Button
                variant="secondary"
                disabled={!encumbered || busy !== null}
                onClick={() => void onDischarge()}
              >
                {busy === "repay" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                4 · Repay & discharge
              </Button>
              {repay?.success && (
                <ResultOk
                  title="DISCHARGED"
                  detail={`Tx ${short(repay.txHash)}`}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">P1 · extra demos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  disabled={!seed || busy !== null}
                  onClick={() => void onComplianceFail()}
                >
                  {busy === "compliance" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <UserX className="size-4" />
                  )}
                  Compliance failure
                </Button>
                <Button
                  variant="outline"
                  disabled={!seed || busy !== null}
                  onClick={() => void onExpiryDemo()}
                >
                  {busy === "expiry" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <TimerReset className="size-4" />
                  )}
                  Reservation expiry
                </Button>
              </div>
              {complianceDemo && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <div className="font-bold">
                    {(complianceDemo.message as string) ?? "COMPLIANCE_BLOCKED"}
                  </div>
                  <p className="mt-1 opacity-90">
                    reason: {String(complianceDemo.reasonCode)} · fundsMoved:{" "}
                    {String(complianceDemo.fundsMoved)} · gate fails before
                    reserve/settlement
                  </p>
                </div>
              )}
              {expiryDemo && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Clock3 className="size-3.5" />
                    {(expiryDemo.message as string) ?? "Reservation expired"}
                  </div>
                  <p className="mt-1 opacity-90">
                    after:{" "}
                    {String(
                      (expiryDemo.afterState as { stateLabel?: string })
                        ?.stateLabel ?? "—",
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">P2 · extension demos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Subordinate claims are protocol-level only. Cross-chain mock is
                not a bridge. Attestations are off-chain commitments.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  disabled={!seed || busy !== null}
                  onClick={() => void onSubordinate()}
                >
                  {busy === "subordinate" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  Subordinate claim
                </Button>
                <Button
                  variant="outline"
                  disabled={!seed || busy !== null}
                  onClick={() => void onXchain()}
                >
                  {busy === "xchain" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  Cross-chain mock
                </Button>
                <Button
                  variant="outline"
                  disabled={!seed || busy !== null}
                  onClick={() => void onAttestations()}
                >
                  {busy === "attest" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  Attestation suite
                </Button>
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void onAnalytics()}
                >
                  {busy === "analytics" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  Analytics
                </Button>
              </div>
              {subordinate && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-950">
                  <strong>Subordinate registered</strong>
                  <p className="mt-1 opacity-90">
                    {String(subordinate.disclaimer)} · claimId{" "}
                    {short(String(subordinate.claimId ?? ""))}
                  </p>
                </div>
              )}
              {xchain && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950">
                  <strong>Cross-chain architecture mock</strong>
                  <p className="mt-1 opacity-90">
                    target 10142 · record{" "}
                    {short(
                      String(
                        (xchain.posted as { recordId?: string })?.recordId ??
                          "",
                      ),
                    )}{" "}
                    · consumed:{" "}
                    {String(
                      Boolean(
                        (xchain.consumed as { success?: boolean })?.success,
                      ),
                    )}
                  </p>
                </div>
              )}
              {attestations && (
                <div className="rounded-lg border border-border p-3 text-xs">
                  <strong>
                    Asset class: {String(attestations.assetClassLabel)}
                  </strong>
                  <p className="mt-1 text-muted-foreground">
                    {Array.isArray(attestations.attestations)
                      ? `${(attestations.attestations as unknown[]).length} adapter commitments`
                      : "—"}
                  </p>
                </div>
              )}
              {analytics && (
                <div className="rounded-lg border border-border p-3 text-xs">
                  <strong>Analytics</strong>
                  <pre className="mt-1 max-h-28 overflow-auto text-[10px] text-muted-foreground">
                    {JSON.stringify(
                      (analytics as { totals?: unknown }).totals ?? analytics,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
              {obligationId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      `${API_BASE}/lien/obligations/${obligationId}/export?format=json&privacy=redacted`,
                      "_blank",
                    )
                  }
                >
                  Export privacy-redacted JSON
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Asset claim graph</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {graph.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Graph nodes appear from the append-only audit trail.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {graph.map((n, i) => (
                    <div key={n.id} className="flex items-stretch gap-2">
                      <div className="flex w-6 flex-col items-center">
                        <span
                          className={cn(
                            "mt-1 size-3 rounded-full",
                            n.kind === "finance_success" && "bg-emerald-500",
                            n.kind === "finance_blocked" && "bg-rose-500",
                            n.kind === "compliance_blocked" && "bg-amber-500",
                            n.kind === "discharged" && "bg-sky-500",
                            n.kind === "reservation_expired" && "bg-violet-500",
                            n.kind === "obligation" && "bg-emerald-700",
                            n.kind === "other" && "bg-muted-foreground",
                          )}
                        />
                        {i < graph.length - 1 && (
                          <span className="mt-1 w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="mb-2 flex-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                        <div className="font-medium">{n.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {n.outcome}
                          {n.reasonCode ? ` · ${n.reasonCode}` : ""}
                          {n.at
                            ? ` · ${new Date(n.at).toLocaleTimeString()}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {audit.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Raw audit ({audit.length})
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {audit.map((e) => (
                      <li
                        key={e.id}
                        className="border-l-2 border-border pl-3 text-xs"
                      >
                        <span className="font-medium">{e.eventType}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {e.outcome}
                          {e.reasonCode ? ` · ${e.reasonCode}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <p>
                LIEN provides <strong>protocol-level encumbrance state</strong>{" "}
                for integrated systems. Demo trust mode uses labeled Cleanverse
                mocks on Hardhat; live mode uses real CVI/CCP when configured.
                Settlement rail may be a labeled dUSDC substitute.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <ArrowRight className="size-4" />
        Race-safety: Hardhat tests — competing reservations, only one succeeds.
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-sm", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

function DocCard({
  title,
  hash,
  body,
  highlight,
}: {
  title: string;
  hash: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight ? "border-amber-200 bg-amber-50/40" : "border-border/70",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <FileText className="size-3.5" />
        {title}
      </div>
      <code className="mb-2 block truncate font-mono text-[10px] text-muted-foreground">
        {hash}
      </code>
      <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-muted-foreground">
        {body}
      </pre>
    </div>
  );
}

function ProtocolCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  disabled,
  loading,
  cta,
  onAction,
  result,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "rose";
  disabled: boolean;
  loading: boolean;
  cta: string;
  onAction: () => void;
  result: React.ReactNode;
}) {
  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon
            className={cn(
              "size-4",
              accent === "emerald" ? "text-emerald-700" : "text-rose-700",
            )}
          />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          variant={accent === "rose" ? "destructive" : "default"}
          disabled={disabled}
          onClick={onAction}
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {cta}
        </Button>
        {result}
      </CardContent>
    </Card>
  );
}

function ResultOk({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
      <div className="text-sm font-bold">{title}</div>
      <p className="mt-1 text-xs opacity-90">{detail}</p>
    </div>
  );
}

function ResultFail({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-950">
      <div className="text-sm font-bold">{title}</div>
      <p className="mt-1 text-xs opacity-90">{detail}</p>
    </div>
  );
}
