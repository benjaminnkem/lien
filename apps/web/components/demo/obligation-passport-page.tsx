"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Address, Hex } from "viem";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSignature,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Unlock,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLienWallet } from "@/hooks/use-lien-wallet";
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/api";
import { txUrl, type LienPublicConfig } from "@/lib/lien-config";
import {
  formatFaceValue,
  normalizeObligationId,
  obligationToTerms,
  shortHex,
  stateBadgeClass,
  type ObligationPassport,
} from "@/lib/obligation";
import { cn } from "@/lib/utils";

type ApiStack = {
  ready: boolean;
  chainId: number;
  trustMode?: string;
  registry?: string | null;
  guard?: string | null;
  protocolA?: string | null;
  protocolB?: string | null;
  settlementToken?: string | null;
};

function sameAddr(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function ObligationPassportPage({
  obligationIdParam,
}: {
  obligationIdParam: string;
}) {
  const obligationId = useMemo(
    () => normalizeObligationId(obligationIdParam),
    [obligationIdParam],
  );

  const [stack, setStack] = useState<ApiStack | null>(null);
  const [data, setData] = useState<ObligationPassport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [obligorSig, setObligorSig] = useState<Hex | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [financeAmount, setFinanceAmount] = useState("80000000000");
  const [borrower, setBorrower] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const configFromApi: Partial<LienPublicConfig> = useMemo(() => {
    if (!stack) return {};
    return {
      chainId: stack.chainId || 11155111,
      registry: (stack.registry as Address) || undefined,
      guard: (stack.guard as Address) || undefined,
      protocolA: (stack.protocolA as Address) || undefined,
      protocolB: (stack.protocolB as Address) || undefined,
      settlementToken: (stack.settlementToken as Address) || undefined,
    };
  }, [stack]);

  const lien = useLienWallet(configFromApi);

  const terms = useMemo(
    () => (data ? obligationToTerms(data.obligation) : null),
    [data],
  );

  const load = useCallback(async () => {
    if (!obligationId) {
      setLoadError("Invalid obligation ID. Expected a 0x… bytes32 hex.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      if (!stack) {
        const s = await apiGet<ApiStack>("/lien/status");
        setStack(s);
      }
      const res = await apiGet<ObligationPassport>(
        `/lien/obligations/${obligationId}`,
      );
      setData(res);
      if (!borrower && res.obligation.supplier) {
        setBorrower(res.obligation.supplier);
      }
    } catch (e) {
      setData(null);
      setLoadError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [obligationId, stack, borrower]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [obligationId]);

  useEffect(() => {
    if (!lien.address) return;
    if (!borrower) setBorrower(lien.address);
  }, [lien.address, borrower]);

  // Restore sig from session if any
  useEffect(() => {
    if (!obligationId) return;
    try {
      const saved = sessionStorage.getItem(`lien-sig:${obligationId}`);
      if (saved?.startsWith("0x")) setObligorSig(saved as Hex);
    } catch {
      /* ignore */
    }
  }, [obligationId]);

  const recordAudit = async (
    eventType: string,
    outcome: string,
    payload: Record<string, unknown>,
  ) => {
    if (!obligationId) return;
    try {
      await apiPost("/lien/live/audit", {
        obligationId,
        eventType,
        outcome,
        payload,
      });
    } catch {
      /* non-fatal */
    }
  };

  const isObligor = sameAddr(lien.address, data?.obligation.obligor);
  const isSupplier = sameAddr(lien.address, data?.obligation.supplier);
  const confirmed = Boolean(data?.obligation.confirmed);
  const cancelled = Boolean(data?.obligation.cancelled);
  const stateLabel = data?.status.stateLabel ?? "—";
  const encumbered = stateLabel === "Encumbered";
  const discharged = stateLabel === "Discharged";
  // After confirm, LienGuard usually shows Verified until reserved/encumbered
  const canFinanceA =
    confirmed &&
    !cancelled &&
    !encumbered &&
    !discharged &&
    stateLabel !== "Reserved";

  const shareUrl =
    typeof window !== "undefined" && obligationId
      ? `${window.location.origin}/o/${obligationId}`
      : obligationId
        ? `/o/${obligationId}`
        : "";

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(
      shareUrl.startsWith("http")
        ? shareUrl
        : `${window.location.origin}${shareUrl}`,
    );
    setShareCopied(true);
    toast.success("Link copied");
    window.setTimeout(() => setShareCopied(false), 1600);
  };

  const onSign = async () => {
    if (!terms) return;
    if (!lien.isConnected) {
      toast.error("Connect the obligor wallet first");
      return;
    }
    if (!isObligor) {
      toast.error(
        `Connect as obligor ${shortHex(data?.obligation.obligor, 4)}`,
      );
      return;
    }
    setBusy("sign");
    try {
      await lien.ensureChain();
      // brief yield so MetaMask sees the active account after any switch
      await new Promise((r) => setTimeout(r, 150));
      const sig = await lien.signAsObligor(terms);
      setObligorSig(sig);
      try {
        sessionStorage.setItem(`lien-sig:${obligationId}`, sig);
      } catch {
        /* ignore */
      }
      await recordAudit("CLIENT_OBLIGOR_SIGN", "success", {
        obligor: terms.obligor,
      });
      toast.success("Signed. Confirm on-chain next.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async () => {
    if (!terms || !obligorSig) {
      toast.error("Sign as obligor first");
      return;
    }
    if (!lien.isConnected) {
      toast.error("Connect a wallet to submit confirmation");
      return;
    }
    if (!isObligor && !isSupplier) {
      toast.error("Only the obligor or supplier can submit confirm");
      return;
    }
    setBusy("confirm");
    try {
      await lien.ensureChain();
      await new Promise((r) => setTimeout(r, 150));
      const hash = await lien.confirmWithSignature(terms, obligorSig);
      setLastTx(hash);
      await recordAudit("CLIENT_CONFIRM", "success", { txHash: hash });
      toast.success("Confirmed on-chain. Obligation is financeable.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSignAndConfirm = async () => {
    if (!terms) return;
    if (!lien.isConnected || !isObligor) {
      toast.error(
        `Connect as obligor ${shortHex(data?.obligation.obligor, 4)}`,
      );
      return;
    }
    setBusy("sign-confirm");
    try {
      await lien.ensureChain();
      await new Promise((r) => setTimeout(r, 200));
      const sig = await lien.signAsObligor(terms);
      setObligorSig(sig);
      try {
        sessionStorage.setItem(`lien-sig:${obligationId}`, sig);
      } catch {
        /* ignore */
      }
      toast.message("Signature captured. Approve the confirm transaction…");
      await new Promise((r) => setTimeout(r, 250));
      const hash = await lien.confirmWithSignature(terms, sig);
      setLastTx(hash);
      await recordAudit("CLIENT_CONFIRM", "success", {
        txHash: hash,
        combined: true,
      });
      toast.success("Signed and confirmed on-chain");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onFinance = async (protocol: "A" | "B") => {
    if (!obligationId || !borrower) {
      toast.error("Need borrower address");
      return;
    }
    setBusy(`finance${protocol}`);
    try {
      await lien.ensureChain();
      const hash = await lien.finance({
        protocol,
        obligationId,
        borrower: borrower as Address,
        amount: BigInt(financeAmount),
      });
      setLastTx(hash);
      await recordAudit(
        protocol === "A" ? "CLIENT_FINANCE_A" : "CLIENT_FINANCE_B",
        "success",
        { txHash: hash, protocol },
      );
      toast.success(
        protocol === "A"
          ? "Protocol A financed. Claim is encumbered."
          : "Protocol B succeeded (unexpected if A already won)",
      );
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordAudit(
        protocol === "A" ? "CLIENT_FINANCE_A" : "CLIENT_FINANCE_B",
        "blocked",
        { error: msg, protocol },
      );
      toast.error(
        protocol === "B"
          ? `Protocol B blocked (expected if A holds claim): ${msg}`
          : msg,
      );
      await load();
    } finally {
      setBusy(null);
    }
  };

  const onRepay = async () => {
    if (!obligationId) return;
    setBusy("repay");
    try {
      await lien.ensureChain();
      const hash = await lien.repay({
        protocol: "A",
        obligationId,
        amount: BigInt(financeAmount),
      });
      setLastTx(hash);
      await recordAudit("CLIENT_REPAY", "success", { txHash: hash });
      toast.success("Repaid and discharged");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!obligationId) {
    return (
      <Shell>
        <EmptyState
          title="Invalid obligation ID"
          body="The URL should look like /o/0x… with a 64-character hex ID."
        />
      </Shell>
    );
  }

  if (loading && !data) {
    return (
      <Shell>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <LoaderCircle className="size-8 animate-spin text-emerald-800 dark:text-emerald-300" />
          <p className="text-sm">Loading obligation from chain…</p>
        </div>
      </Shell>
    );
  }

  if (loadError || !data || !terms) {
    return (
      <Shell>
        <EmptyState
          title="Obligation not found"
          body={
            loadError ??
            "This ID is not registered on the configured chain yet. Ask the supplier to finish Register first."
          }
          action={
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          }
        />
      </Shell>
    );
  }

  const o = data.obligation;

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/demo"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to demo
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Obligation passport
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Shared page for obligor confirmation and financing. Connect the
            wallet that matches the step you are doing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full"
            onClick={() => void load()}
            disabled={!!busy}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <ConnectButton
            chainStatus="icon"
            accountStatus="address"
            showBalance={false}
          />
        </div>
      </div>

      {/* Passport card */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_24px_60px_-36px_rgba(12,34,31,0.45)]">
        <div className="flex flex-col gap-4 border-b border-white/10 bg-[linear-gradient(135deg,#0c221f_0%,#133e37_50%,#1a4f45_100%)] px-5 py-6 text-white sm:flex-row sm:items-start sm:justify-between sm:px-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-emerald-200/80 uppercase">
              Invoice · {o.invoiceReference}
            </p>
            <p className="mt-1 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {shortHex(o.supplier, 4)} → {shortHex(o.obligor, 4)}
            </p>
            <p className="mt-2 font-mono text-[11px] break-all text-emerald-100/70">
              {obligationId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                stateBadgeClass(stateLabel),
              )}
            >
              {cancelled ? "Cancelled" : stateLabel}
            </span>
            <Badge
              variant="outline"
              className="border-white/20 bg-white/10 text-white"
            >
              {confirmed ? "Obligor confirmed" : "Awaiting confirmation"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">
          <Field
            label="Face value"
            value={formatFaceValue(o.faceValue, o.currency)}
          />
          <Field
            label="Due"
            value={
              o.dueDate
                ? new Date(o.dueDate * 1000).toLocaleDateString()
                : "—"
            }
          />
          <Field label="Jurisdiction" value={o.jurisdiction || "—"} />
          <Field
            label="Secured"
            value={
              data.status.securedAmount && data.status.securedAmount !== "0"
                ? formatFaceValue(data.status.securedAmount, "dUSDC")
                : "—"
            }
          />
          <Field label="Supplier" value={shortHex(o.supplier, 5)} mono />
          <Field label="Obligor" value={shortHex(o.obligor, 5)} mono />
          <Field
            label="Controller"
            value={
              data.status.claimController &&
              data.status.claimController !==
                "0x0000000000000000000000000000000000000000"
                ? shortHex(data.status.claimController, 5)
                : "—"
            }
            mono
          />
          <Field label="Trust" value={stack?.trustMode ?? "—"} />
        </div>

        <div className="border-t border-border/60 px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Share this passport
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/o/${obligationId}`
                  : `/o/${obligationId}`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-full"
              onClick={() => void copyShare()}
            >
              <Copy className="size-3.5" />
              {shareCopied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      </div>

      {/* Wallet role hint */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {lien.isConnected ? (
          <>
            <Badge variant="outline" className="font-mono text-[11px]">
              {shortHex(lien.address, 4)}
            </Badge>
            {isObligor && (
              <span className="text-emerald-800 dark:text-emerald-300">
                Connected as obligor
              </span>
            )}
            {isSupplier && !isObligor && (
              <span className="text-muted-foreground">
                Connected as supplier
              </span>
            )}
            {!isObligor && !isSupplier && (
              <span className="text-amber-800 dark:text-amber-200">
                Connected wallet is neither party
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">
            Connect a wallet to act on this obligation
          </span>
        )}
      </div>

      {cancelled && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-100">
          This obligation was cancelled.
        </div>
      )}

      {/* Step sections */}
      <div className="mt-8 space-y-4">
        {/* Confirm */}
        {!cancelled && !confirmed && (
          <ActionCard
            step="1"
            title="Obligor confirmation"
            body="Connect the obligor wallet, then sign the economic terms (EIP-712) and submit confirmation on-chain."
            highlight
          >
            {!isObligor && lien.isConnected && (
              <div className="mb-4 flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  Switch MetaMask to{" "}
                  <span className="font-mono font-medium">
                    {shortHex(o.obligor, 6)}
                  </span>{" "}
                  (the obligor). Signing from another account will fail.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                size="lg"
                className="h-11 rounded-full px-5"
                disabled={!!busy || !lien.isConnected || !isObligor}
                onClick={() => void onSignAndConfirm()}
              >
                {busy === "sign-confirm" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileSignature className="size-4" />
                )}
                Sign & confirm (obligor)
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-full px-5"
                disabled={!!busy || !lien.isConnected || !isObligor}
                onClick={() => void onSign()}
              >
                {busy === "sign" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Wallet className="size-4" />
                )}
                Sign only
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-11 rounded-full px-5"
                disabled={
                  !!busy ||
                  !lien.isConnected ||
                  !obligorSig ||
                  (!isObligor && !isSupplier)
                }
                onClick={() => void onConfirm()}
              >
                {busy === "confirm" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Submit confirm tx
                {obligorSig ? "" : " (need signature)"}
              </Button>
            </div>
            {obligorSig && (
              <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
                Signature ready locally. Submit confirm to make the claim
                financeable.
              </p>
            )}
          </ActionCard>
        )}

        {confirmed && !cancelled && (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-950/30 dark:text-emerald-100">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>
              Obligor confirmed. Claim can be financed by Protocol A (exclusive
              reserve).
            </p>
          </div>
        )}

        {/* Finance */}
        {!cancelled && confirmed && (
          <ActionCard
            step="2"
            title="Finance"
            body="Protocol A locks the exclusive claim and moves demo settlement. Protocol B should fail if A already succeeded."
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Borrower</Label>
                <Input
                  value={borrower}
                  onChange={(e) => setBorrower(e.target.value)}
                  className="h-10 font-mono text-xs"
                  placeholder="0x…"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Amount (raw units)
                </Label>
                <Input
                  value={financeAmount}
                  onChange={(e) => setFinanceAmount(e.target.value)}
                  className="h-10 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                size="lg"
                className="h-11 rounded-full px-5"
                disabled={
                  !!busy || !lien.isConnected || !canFinanceA
                }
                onClick={() => void onFinance("A")}
              >
                {busy === "financeA" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Landmark className="size-4" />
                )}
                Finance · Protocol A
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-11 rounded-full px-5"
                disabled={!!busy || !lien.isConnected || discharged}
                onClick={() => void onFinance("B")}
              >
                {busy === "financeB" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Ban className="size-4" />
                )}
                Attack · Protocol B
              </Button>
            </div>
            {encumbered && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-100">
                <ShieldAlert className="size-3.5" />
                Encumbered. Protocol B should fail if you try it.
              </p>
            )}
          </ActionCard>
        )}

        {/* Discharge */}
        {encumbered && (
          <ActionCard
            step="3"
            title="Repay & discharge"
            body="Release the exclusive claim after repayment (demo mints dUSDC if needed)."
          >
            <Button
              size="lg"
              variant="secondary"
              className="h-11 rounded-full px-5"
              disabled={!!busy || !lien.isConnected}
              onClick={() => void onRepay()}
            >
              {busy === "repay" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Unlock className="size-4" />
              )}
              Repay & discharge
            </Button>
          </ActionCard>
        )}

        {discharged && (
          <div className="flex items-start gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-sm text-sky-950 dark:border-sky-400/25 dark:bg-sky-950/30 dark:text-sky-100">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>Discharged. History is retained on-chain and in audit.</p>
          </div>
        )}
      </div>

      {lastTx && (
        <a
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline dark:text-emerald-300"
          href={txUrl(lien.config.explorerBase, lastTx)}
          target="_blank"
          rel="noreferrer"
        >
          View last transaction {shortHex(lastTx)}
          <ExternalLink className="size-3.5" />
        </a>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Protocol-level encumbrance for integrated systems. If MetaMask hangs on
        sign, open the extension, clear pending requests, ensure Sepolia, and
        retry. Prefer one wallet per browser profile for multi-party demos.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,rgba(16,42,38,0.08),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(16,42,38,0.22),transparent_65%)]" />
      {children}
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card px-6 py-12 text-center shadow-sm">
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {body}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {action}
        <Link
          href="/demo"
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted",
          )}
        >
          Go to demo
        </Link>
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
      <dt className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

function ActionCard({
  step,
  title,
  body,
  children,
  highlight,
}: {
  step: string;
  title: string;
  body: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border p-5 sm:p-6",
        highlight
          ? "border-emerald-200/90 bg-emerald-50/40 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-950/20"
          : "border-border/70 bg-card/80",
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-xs font-bold text-white dark:bg-emerald-700">
          {step}
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
