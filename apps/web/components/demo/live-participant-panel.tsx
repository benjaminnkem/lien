"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress, type Address, type Hex } from "viem";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLienWallet, type PreparedTerms } from "@/hooks/use-lien-wallet";
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/api";
import { txUrl, type LienPublicConfig } from "@/lib/lien-config";
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
  priorityBook?: string | null;
  crossChainMock?: string | null;
};

type StatusView = {
  state: number;
  stateLabel: string;
  securedAmount: string;
  claimController: string;
};

const DOC_A =
  "INVOICE INV-LIVE\nSupplier → Obligor\nFace: USD 100,000\nPO: PO-LIVE\nRendered: PDF v1";

function short(h?: string | null) {
  if (!h) return "—";
  return h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

export function LiveParticipantPanel() {
  const [stack, setStack] = useState<ApiStack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [terms, setTerms] = useState<PreparedTerms | null>(null);
  const [obligationId, setObligationId] = useState<Hex | null>(null);
  const [status, setStatus] = useState<StatusView | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [gateNote, setGateNote] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [supplierInput, setSupplierInput] = useState("");
  const [obligorInput, setObligorInput] = useState("");
  const [invoiceRef, setInvoiceRef] = useState(
    `INV-LIVE-${Math.floor(Date.now() / 1000) % 100000}`,
  );
  const [faceValue, setFaceValue] = useState("100000000000");

  const configFromApi: Partial<LienPublicConfig> = useMemo(() => {
    if (!stack) return {};
    return {
      chainId: stack.chainId || 11155111,
      registry: (stack.registry as Address) || undefined,
      guard: (stack.guard as Address) || undefined,
      protocolA: (stack.protocolA as Address) || undefined,
      protocolB: (stack.protocolB as Address) || undefined,
      settlementToken: (stack.settlementToken as Address) || undefined,
      priorityBook: (stack.priorityBook as Address) || undefined,
      crossChainMock: (stack.crossChainMock as Address) || undefined,
    };
  }, [stack]);

  const lien = useLienWallet(configFromApi);

  useEffect(() => {
    void (async () => {
      try {
        const s = await apiGet<ApiStack>("/lien/status");
        setStack(s);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!lien.address) return;
    if (!supplierInput) setSupplierInput(lien.address);
  }, [lien.address, supplierInput]);

  const refreshStatus = useCallback(async (oid: Hex) => {
    try {
      const res = await apiGet<{ status: StatusView }>(
        `/lien/obligations/${oid}`,
      );
      setStatus(res.status);
    } catch {
      /* chain may be ahead of API RPC */
    }
  }, []);

  const recordAudit = useCallback(
    async (
      eventType: string,
      outcome: string,
      payload: Record<string, unknown>,
      oid?: string,
    ) => {
      try {
        await apiPost<unknown, Record<string, unknown>>("/lien/live/audit", {
          obligationId: oid ?? obligationId,
          eventType,
          outcome,
          payload,
        });
      } catch {
        /* non-fatal */
      }
    },
    [obligationId],
  );

  const runCvi = async (address: string, role: string) => {
    try {
      const res = await apiPost<
        {
          eligible: boolean;
          gate: {
            cvi: { eligible: boolean; message: string };
            ccp: { allowed: boolean; message: string };
            source: string;
          };
          trustMode: string;
        },
        { address: string; role: string }
      >("/lien/live/cvi-check", { address, role });
      const ccpMsg = res.gate?.ccp?.message
        ? ` · CCP: ${res.gate.ccp.message}`
        : "";
      setGateNote(
        `${role}: ${res.eligible ? "eligible" : "blocked"} · ${res.trustMode} · CVI: ${res.gate.cvi.message}${ccpMsg}`,
      );
      if (!res.eligible) {
        const why =
          res.gate.cvi.eligible === false
            ? res.gate.cvi.message
            : (res.gate.ccp.message ?? "compliance gate");
        toast.error(`${role} blocked: ${why}`);
        return false;
      }
      return true;
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      return false;
    }
  };

  const onPrepare = async () => {
    if (!isAddress(supplierInput) || !isAddress(obligorInput)) {
      toast.error("Enter valid supplier and obligor addresses");
      return;
    }
    setBusy("prepare");
    try {
      const dueDate = Math.floor(Date.now() / 1000) + 90 * 86400;
      const prepared = await apiPost<
        {
          terms: {
            supplier: string;
            obligor: string;
            currency: string;
            faceValue: string;
            dueDate: number;
            invoiceReference: string;
            purchaseOrderReference: string;
            evidenceRoot: string;
            jurisdiction: string;
            version: string;
            nonce: string;
          };
          obligationId: string;
        },
        Record<string, unknown>
      >("/lien/live/prepare", {
        supplier: supplierInput,
        obligor: obligorInput,
        currency: "USD",
        faceValue,
        dueDate,
        invoiceReference: invoiceRef,
        purchaseOrderReference: "PO-LIVE",
        evidenceContent: DOC_A,
        jurisdiction: "SG",
      });

      const t: PreparedTerms = {
        supplier: prepared.terms.supplier as Address,
        obligor: prepared.terms.obligor as Address,
        currency: prepared.terms.currency,
        faceValue: BigInt(prepared.terms.faceValue),
        dueDate: prepared.terms.dueDate,
        invoiceReference: prepared.terms.invoiceReference,
        purchaseOrderReference: prepared.terms.purchaseOrderReference,
        evidenceRoot: prepared.terms.evidenceRoot as Hex,
        jurisdiction: prepared.terms.jurisdiction,
        version: BigInt(prepared.terms.version),
        nonce: prepared.terms.nonce as Hex,
      };
      setTerms(t);
      setObligationId(prepared.obligationId as Hex);
      setStatus(null);
      await recordAudit(
        "CLIENT_PREPARE",
        "success",
        { invoiceReference: invoiceRef },
        prepared.obligationId,
      );
      toast.success("Terms prepared");
    } catch (e) {
      // Fallback: build client-side if prepare API missing
      try {
        const t = lien.buildTerms({
          supplier: supplierInput as Address,
          obligor: obligorInput as Address,
          faceValue,
          dueDate: Math.floor(Date.now() / 1000) + 90 * 86400,
          invoiceReference: invoiceRef,
          purchaseOrderReference: "PO-LIVE",
          evidenceContent: DOC_A,
          jurisdiction: "SG",
        });
        setTerms(t);
        const oid = await lien.computeObligationId(t);
        setObligationId(oid);
        toast.success("Terms prepared (client)");
      } catch {
        toast.error(getApiErrorMessage(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const onRegister = async () => {
    if (!terms) return;
    setBusy("register");
    try {
      const ok = await runCvi(terms.supplier, "supplier");
      if (!ok) return;
      const hash = await lien.registerAsSupplier(terms);
      setLastTx(hash);
      const oid = await lien.computeObligationId(terms);
      setObligationId(oid);
      await recordAudit(
        "CLIENT_REGISTER",
        "success",
        { txHash: hash, role: "supplier" },
        oid,
      );
      await refreshStatus(oid);
      toast.success("Registered. Share the passport link with the obligor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const passportPath = obligationId ? `/o/${obligationId}` : null;
  const passportUrl =
    typeof window !== "undefined" && passportPath
      ? `${window.location.origin}${passportPath}`
      : passportPath;

  const copyLink = async () => {
    if (!passportUrl) return;
    await navigator.clipboard.writeText(passportUrl);
    setLinkCopied(true);
    toast.success("Passport link copied");
    window.setTimeout(() => setLinkCopied(false), 1600);
  };

  const wrongChain =
    lien.isConnected &&
    lien.chainId != null &&
    stack?.chainId != null &&
    lien.chainId !== stack.chainId;

  const steps = [
    { id: "prepare", label: "Prepare", done: Boolean(terms) },
    { id: "register", label: "Register", done: Boolean(obligationId && lastTx) },
    {
      id: "share",
      label: "Share",
      done: Boolean(obligationId && lastTx),
    },
  ];

  const registered = Boolean(obligationId && lastTx);

  return (
    <Card className="gap-0 overflow-hidden border-border/60 py-0 shadow-[0_20px_50px_-28px_rgba(16,42,38,0.45)] ring-1 ring-emerald-900/5 dark:ring-emerald-400/10">
      <CardHeader className="rounded-none border-b border-white/10 bg-[linear-gradient(135deg,#0c221f_0%,#133e37_48%,#1a4f45_100%)] py-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-emerald-100/95 uppercase backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.25)]" />
              Live · Sepolia · supplier start
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
                Create and share an obligation
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/80">
                Supplier prepares terms and registers on-chain, then shares a
                passport link. The obligor opens that page (own wallet) to sign
                and confirm. No account switching on this screen.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-black/20 p-2 backdrop-blur-sm">
            <ConnectButton
              chainStatus="full"
              accountStatus="address"
              showBalance={false}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={lien.ready || stack?.ready ? "default" : "secondary"}
            className="h-7 gap-1.5 rounded-full px-3"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                lien.ready || stack?.ready
                  ? "bg-emerald-300"
                  : "bg-muted-foreground",
              )}
            />
            {lien.ready || stack?.ready ? "Contracts ready" : "Addresses missing"}
          </Badge>
          <Badge variant="outline" className="h-7 rounded-full px-3 font-normal">
            Chain {stack?.chainId ?? "—"}
          </Badge>
          <Badge variant="outline" className="h-7 rounded-full px-3 font-normal">
            Trust {stack?.trustMode ?? "—"}
          </Badge>
          <Badge
            variant="outline"
            className="h-7 rounded-full px-3 font-mono text-[11px]"
          >
            {lien.isConnected ? short(lien.address) : "Wallet disconnected"}
          </Badge>
          {status && (
            <Badge
              variant="outline"
              className="h-7 rounded-full px-3 border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              {status.stateLabel}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                s.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "border-border/70 bg-muted/40 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  s.done
                    ? "bg-emerald-700 text-white"
                    : "bg-background text-muted-foreground ring-1 ring-border",
                )}
              >
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              {s.label}
            </div>
          ))}
        </div>

        {wrongChain && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center dark:border-amber-400/25 dark:bg-amber-950/30">
            <div className="flex min-w-0 flex-1 gap-2 text-sm text-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Wrong network. Switch to chain {stack?.chainId} (Sepolia for
                live).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => void lien.ensureChain()}
            >
              Switch network
            </Button>
          </div>
        )}

        {gateNote && (
          <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {gateNote}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <Users className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Parties & terms</h3>
                <p className="text-[11px] text-muted-foreground">
                  Supplier registers · obligor address receives the share link
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <AddrField
                label="Supplier"
                value={supplierInput}
                onChange={setSupplierInput}
                connected={lien.address}
                hint="Must match the connected wallet for register"
              />
              <AddrField
                label="Obligor"
                value={obligorInput}
                onChange={setObligorInput}
                connected={lien.address}
                hint="Person who will open the passport link"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Invoice ref
                  </Label>
                  <Input
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    className="h-10 font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Face value (raw)
                  </Label>
                  <Input
                    value={faceValue}
                    onChange={(e) => setFaceValue(e.target.value)}
                    className="h-10 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Supplier actions</h3>
                <p className="text-[11px] text-muted-foreground">
                  Prepare → register → share
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <ActionRow
                step="1"
                title="Prepare terms"
                desc="Build economic terms + Obligation ID"
                loading={busy === "prepare"}
                disabled={!!busy || !lien.isConnected}
                onClick={() => void onPrepare()}
              />
              <ActionRow
                step="2"
                title="Register as supplier"
                desc="On-chain register (supplier wallet)"
                loading={busy === "register"}
                disabled={!!busy || !terms || !lien.isConnected}
                onClick={() => void onRegister()}
                primary
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Obligation ID
              </p>
              <code className="mt-1 block break-all font-mono text-[11px] leading-relaxed">
                {obligationId ?? "Prepare terms to derive the ID"}
              </code>
              {lastTx && (
                <a
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline dark:text-emerald-300"
                  href={txUrl(lien.config.explorerBase, lastTx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Register tx {short(lastTx)}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </section>
        </div>

        {/* Share panel */}
        {obligationId && (
          <section
            className={cn(
              "rounded-2xl border p-5 sm:p-6",
              registered
                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-400/25 dark:bg-emerald-950/25"
                : "border-border/70 bg-muted/15",
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-900 uppercase dark:text-emerald-200">
                  {registered ? "Step 3 · Share with obligor" : "Passport link"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {registered
                    ? "Send this link. Obligor opens it, connects their wallet, and completes sign + confirm without switching accounts here."
                    : "Available after prepare. Share after register so terms exist on-chain."}
                </p>
                <p className="mt-2 truncate font-mono text-xs text-foreground/80">
                  {passportUrl ?? passportPath}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-10 rounded-full"
                  onClick={() => void copyLink()}
                >
                  {linkCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {linkCopied ? "Copied" : "Copy link"}
                </Button>
                <Link
                  href={passportPath!}
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "h-10 rounded-full px-4",
                  )}
                >
                  Open passport
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">How multi-party works. </strong>
          Supplier stays on this page (prepare + register). Obligor uses the
          passport link on another device or browser profile. Financing and the
          Protocol B attack live on the passport page after confirmation.
        </div>
      </CardContent>
    </Card>
  );
}

function AddrField({
  label,
  value,
  onChange,
  connected,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  connected?: string | null;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {connected && (
          <button
            type="button"
            className="text-[11px] font-medium text-emerald-800 hover:underline dark:text-emerald-300"
            onClick={() => onChange(connected)}
          >
            Use connected
          </button>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0x…"
        className="h-10 font-mono text-xs"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ActionRow({
  step,
  title,
  desc,
  loading,
  disabled,
  onClick,
  primary,
}: {
  step: string;
  title: string;
  desc: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        "disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "border-emerald-800/20 bg-emerald-900 text-white hover:bg-emerald-800"
          : "border-border/70 bg-background hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:border-emerald-400/20 dark:hover:bg-emerald-950/30",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          primary
            ? "bg-white/15 text-white"
            : "bg-muted text-muted-foreground",
        )}
      >
        {loading ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          step
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {step === "2" ? (
            <Wallet className="size-3.5 opacity-80" />
          ) : (
            <ShieldCheck className="size-3.5 opacity-80" />
          )}
          {title}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[11px]",
            primary ? "text-emerald-100/80" : "text-muted-foreground",
          )}
        >
          {desc}
        </span>
      </span>
    </button>
  );
}
