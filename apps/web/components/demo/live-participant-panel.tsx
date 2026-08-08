"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { isAddress, type Address, type Hex } from "viem";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  Landmark,
  LoaderCircle,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
const DOC_B =
  "INVOICE INV-LIVE\nSupplier → Obligor\nFace: USD 100,000\nPO: PO-LIVE\nRendered: PDF v2 modified binary same economics";

function short(h?: string | null) {
  if (!h) return "—";
  return h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

export function LiveParticipantPanel() {
  const [stack, setStack] = useState<ApiStack | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [terms, setTerms] = useState<PreparedTerms | null>(null);
  const [obligationId, setObligationId] = useState<Hex | null>(null);
  const [obligorSig, setObligorSig] = useState<Hex | null>(null);
  const [status, setStatus] = useState<StatusView | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [gateNote, setGateNote] = useState<string | null>(null);

  // Counterpart addresses (second wallet / second browser for multi-party)
  const [supplierInput, setSupplierInput] = useState("");
  const [obligorInput, setObligorInput] = useState("");
  const [borrowerInput, setBorrowerInput] = useState("");
  const [invoiceRef, setInvoiceRef] = useState(
    `INV-LIVE-${Math.floor(Date.now() / 1000) % 100000}`,
  );
  const [faceValue, setFaceValue] = useState("100000000000"); // 100k * 1e6
  const [financeAmount, setFinanceAmount] = useState("80000000000");

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

  // Prefill supplier/obligor/borrower from connected wallet when empty
  useEffect(() => {
    if (!lien.address) return;
    if (!supplierInput) setSupplierInput(lien.address);
    if (!borrowerInput) setBorrowerInput(lien.address);
  }, [lien.address, supplierInput, borrowerInput]);

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
          predictedObligationId: string | null;
          gates: unknown[];
        },
        Record<string, unknown>
      >("/lien/live/prepare", {
        supplier: supplierInput,
        obligor: obligorInput,
        faceValue,
        dueDate,
        invoiceReference: invoiceRef,
        purchaseOrderReference: "PO-LIVE",
        evidenceContent: DOC_A,
        evidenceContentB: DOC_B,
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
      if (prepared.predictedObligationId) {
        setObligationId(prepared.predictedObligationId as Hex);
      }
      toast.success("Terms prepared — supplier can register on-chain");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
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
      toast.success("Registered on-chain");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSignObligor = async () => {
    if (!terms) return;
    setBusy("sign");
    try {
      const ok = await runCvi(terms.obligor, "obligor");
      if (!ok) return;
      const sig = await lien.signAsObligor(terms);
      setObligorSig(sig);
      await recordAudit("CLIENT_OBLIGOR_SIGN", "success", {
        obligor: terms.obligor,
      });
      toast.success("Obligor EIP-712 signature captured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = async () => {
    if (!terms || !obligorSig) {
      toast.error("Need prepared terms + obligor signature");
      return;
    }
    setBusy("confirm");
    try {
      const hash = await lien.confirmWithSignature(terms, obligorSig);
      setLastTx(hash);
      const oid = obligationId ?? (await lien.computeObligationId(terms));
      setObligationId(oid);
      await recordAudit("CLIENT_CONFIRM", "success", { txHash: hash }, oid);
      await refreshStatus(oid);
      toast.success("Obligor confirmed — obligation financeable");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onFinance = async (protocol: "A" | "B") => {
    if (!obligationId || !isAddress(borrowerInput)) {
      toast.error("Need obligation id + borrower");
      return;
    }
    setBusy(`finance${protocol}`);
    try {
      if (lien.address) {
        await runCvi(lien.address, `financier_${protocol}`);
      }
      let liqBefore: bigint | null = null;
      try {
        liqBefore = await lien.readLiquidity(protocol);
      } catch {
        /* ignore */
      }
      const hash = await lien.finance({
        protocol,
        obligationId,
        borrower: borrowerInput as Address,
        amount: BigInt(financeAmount),
      });
      setLastTx(hash);
      await recordAudit(
        protocol === "A" ? "CLIENT_FINANCE_A" : "CLIENT_FINANCE_B",
        "success",
        { txHash: hash, protocol, liqBefore: liqBefore?.toString() },
        obligationId,
      );
      await refreshStatus(obligationId);
      toast.success(`Protocol ${protocol} finance tx submitted`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordAudit(
        protocol === "A" ? "CLIENT_FINANCE_A" : "CLIENT_FINANCE_B",
        "blocked",
        { error: msg, protocol },
        obligationId ?? undefined,
      );
      toast.error(
        protocol === "B" ? `Protocol B blocked / failed: ${msg}` : msg,
      );
      if (obligationId) await refreshStatus(obligationId);
    } finally {
      setBusy(null);
    }
  };

  const onRepay = async () => {
    if (!obligationId) return;
    setBusy("repay");
    try {
      const hash = await lien.repay({
        protocol: "A",
        obligationId,
        amount: BigInt(financeAmount),
      });
      setLastTx(hash);
      await recordAudit(
        "CLIENT_REPAY",
        "success",
        { txHash: hash },
        obligationId,
      );
      await refreshStatus(obligationId);
      toast.success("Repaid + discharged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSubordinate = async () => {
    if (!obligationId) return;
    setBusy("sub");
    try {
      const hash = await lien.registerSubordinate({
        obligationId,
        priorityRank: 1,
        amount: BigInt("20000000000"),
        label: "live-junior",
      });
      setLastTx(hash);
      await recordAudit(
        "CLIENT_SUBORDINATE",
        "success",
        { txHash: hash },
        obligationId,
      );
      toast.success("Subordinate claim registered (protocol-level)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onXchain = async () => {
    if (!obligationId) return;
    setBusy("xchain");
    try {
      const { hash } = await lien.postXchain({ obligationId });
      setLastTx(hash);
      await recordAudit(
        "CLIENT_XCHAIN_POST",
        "success",
        { txHash: hash },
        obligationId,
      );
      toast.message("Cross-chain mock posted (not a bridge)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const wrongChain =
    lien.isConnected &&
    lien.chainId != null &&
    stack?.chainId != null &&
    lien.chainId !== stack.chainId;

  const steps = [
    { id: "prepare", label: "Prepare", done: Boolean(terms) },
    { id: "register", label: "Register", done: Boolean(obligationId && terms) },
    { id: "sign", label: "Sign", done: Boolean(obligorSig) },
    {
      id: "confirm",
      label: "Confirm",
      done: Boolean(status && status.stateLabel !== "Unregistered"),
    },
    {
      id: "finance",
      label: "Finance",
      done: status?.stateLabel === "Encumbered" || status?.stateLabel === "Discharged",
    },
    { id: "done", label: "Done", done: status?.stateLabel === "Discharged" },
  ];

  const AddrField = ({
    label,
    value,
    onChange,
    hint,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    hint?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {lien.address && (
          <button
            type="button"
            className="text-[11px] font-medium text-emerald-800 hover:underline"
            onClick={() => onChange(lien.address!)}
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

  return (
    <Card className="gap-0 overflow-hidden border-border/60 py-0 shadow-[0_20px_50px_-28px_rgba(16,42,38,0.45)] ring-1 ring-emerald-900/5">
      <CardHeader className="rounded-none border-b border-white/10 bg-[linear-gradient(135deg,#0c221f_0%,#133e37_48%,#1a4f45_100%)] py-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-emerald-100/95 uppercase backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.25)]" />
              Live · Sepolia wallets
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
                Connect, sign, finance on testnet
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/80">
                Real browser-wallet transactions against deployed LIEN contracts.
                Supplier registers · obligor signs EIP-712 · any wallet can call
                Protocol A/B. CVI gates apply when trust mode is live.
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
        {/* Status strip */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={lien.ready || stack?.ready ? "default" : "secondary"}
            className="h-7 gap-1.5 rounded-full px-3"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                lien.ready || stack?.ready ? "bg-emerald-300" : "bg-muted-foreground",
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
          <Badge variant="outline" className="h-7 rounded-full px-3 font-mono text-[11px]">
            {lien.isConnected ? short(lien.address) : "Wallet disconnected"}
          </Badge>
          {status && (
            <Badge
              variant="outline"
              className={cn(
                "h-7 rounded-full px-3",
                status.stateLabel === "Encumbered" &&
                  "border-amber-300 bg-amber-50 text-amber-950",
                status.stateLabel === "Verified" &&
                  "border-emerald-300 bg-emerald-50 text-emerald-950",
                status.stateLabel === "Discharged" &&
                  "border-sky-300 bg-sky-50 text-sky-950",
              )}
            >
              {status.stateLabel}
            </Badge>
          )}
        </div>

        {/* Progress steps */}
        <div className="flex flex-wrap gap-2">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                s.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
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
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 gap-2 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Wrong network. Switch your wallet to chain{" "}
                <strong>{stack?.chainId}</strong> (Sepolia for live).
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300 bg-white"
              onClick={() => void lien.ensureChain()}
            >
              Switch network
            </Button>
          </div>
        )}

        {gateNote && (
          <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Gate: </span>
            {gateNote}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Parties + terms */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Users className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Parties</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Two wallets recommended for supplier vs obligor
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-1">
                <AddrField
                  label="Supplier"
                  value={supplierInput}
                  onChange={setSupplierInput}
                  hint="Connect as this address to register"
                />
                <AddrField
                  label="Obligor"
                  value={obligorInput}
                  onChange={setObligorInput}
                  hint="Connect as this address to sign EIP-712"
                />
                <AddrField
                  label="Borrower (receives finance)"
                  value={borrowerInput}
                  onChange={setBorrowerInput}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                  <FileSignature className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Obligation terms</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Face value uses 6-decimal dUSDC units
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Invoice reference
                  </Label>
                  <Input
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Face value
                  </Label>
                  <Input
                    value={faceValue}
                    onChange={(e) => setFaceValue(e.target.value)}
                    className="h-10 font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Finance amount
                  </Label>
                  <Input
                    value={financeAmount}
                    onChange={(e) => setFinanceAmount(e.target.value)}
                    className="h-10 font-mono text-xs"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Obligation + actions */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(16,42,38,0.04),transparent)] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Obligation ID</h3>
                {obligorSig && (
                  <Badge className="rounded-full bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                    Obligor signed
                  </Badge>
                )}
              </div>
              <code className="block break-all rounded-xl border border-border/60 bg-background/80 px-3 py-3 font-mono text-[11px] leading-relaxed sm:text-xs">
                {obligationId ?? "Prepare terms to derive the canonical ID"}
              </code>
              {terms && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Evidence {short(terms.evidenceRoot)} · Nonce{" "}
                  {short(terms.nonce)}
                </p>
              )}
              {lastTx && (
                <a
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:underline"
                  href={txUrl(lien.config.explorerBase, lastTx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View last tx {short(lastTx)}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                  <Landmark className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Actions</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Run in order · switch wallet when role changes
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <ActionRow
                  step="1"
                  title="Prepare terms"
                  desc="Build EIP-712 payload + CVI context"
                  loading={busy === "prepare"}
                  disabled={!!busy || !lien.isConnected}
                  onClick={() => void onPrepare()}
                  icon={ShieldCheck}
                />
                <ActionRow
                  step="2"
                  title="Register as supplier"
                  desc="On-chain ObligationRegistry.register"
                  loading={busy === "register"}
                  disabled={!!busy || !terms || !lien.isConnected}
                  onClick={() => void onRegister()}
                  icon={Wallet}
                />
                <ActionRow
                  step="3"
                  title="Sign as obligor"
                  desc="EIP-712 economic terms only"
                  loading={busy === "sign"}
                  disabled={!!busy || !terms || !lien.isConnected}
                  onClick={() => void onSignObligor()}
                  icon={FileSignature}
                />
                <ActionRow
                  step="4"
                  title="Confirm on-chain"
                  desc="Submit obligor signature"
                  loading={busy === "confirm"}
                  disabled={!!busy || !terms || !obligorSig || !lien.isConnected}
                  onClick={() => void onConfirm()}
                  icon={CheckCircle2}
                />
                <ActionRow
                  step="5"
                  title="Finance · Protocol A"
                  desc="Reserve + fund + activate"
                  loading={busy === "financeA"}
                  disabled={!!busy || !obligationId || !lien.isConnected}
                  onClick={() => void onFinance("A")}
                  icon={Landmark}
                  primary
                />
                <ActionRow
                  step="6"
                  title="Attack · Protocol B"
                  desc="Should fail if already encumbered"
                  loading={busy === "financeB"}
                  disabled={!!busy || !obligationId || !lien.isConnected}
                  onClick={() => void onFinance("B")}
                  icon={ArrowUpRight}
                  danger
                />
                <ActionRow
                  step="7"
                  title="Repay & discharge"
                  desc="Release exclusive claim"
                  loading={busy === "repay"}
                  disabled={!!busy || !obligationId || !lien.isConnected}
                  onClick={() => void onRepay()}
                  icon={CheckCircle2}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={!!busy || !obligationId || !lien.isConnected}
                  onClick={() => void onSubordinate()}
                >
                  {busy === "sub" ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : null}
                  Subordinate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={!!busy || !obligationId || !lien.isConnected}
                  onClick={() => void onXchain()}
                >
                  {busy === "xchain" ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : null}
                  X-chain mock
                </Button>
              </div>
            </section>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Multi-wallet tip. </strong>
          Use two browser profiles (or switch accounts). Profile 1 = supplier
          (prepare → register → confirm). Profile 2 = obligor (sign only). Any
          profile can finance A then attack with B — B should revert if A
          already encumbered.
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({
  step,
  title,
  desc,
  loading,
  disabled,
  onClick,
  icon: Icon,
  primary,
  danger,
}: {
  step: string;
  title: string;
  desc: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        "disabled:cursor-not-allowed disabled:opacity-45",
        primary &&
          "border-emerald-800/20 bg-emerald-900 text-white hover:bg-emerald-800",
        danger &&
          !primary &&
          "border-rose-200 bg-rose-50/80 text-rose-950 hover:bg-rose-50",
        !primary &&
          !danger &&
          "border-border/70 bg-background hover:border-emerald-200 hover:bg-emerald-50/40",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          primary && "bg-white/15 text-white",
          danger && !primary && "bg-rose-100 text-rose-800",
          !primary && !danger && "bg-muted text-muted-foreground",
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
          <Icon className="size-3.5 opacity-80" />
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
