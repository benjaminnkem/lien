"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  isAddress,
  type Address,
  type Hex,
} from "viem";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
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
      await recordAudit(
        "CLIENT_CONFIRM",
        "success",
        { txHash: hash },
        oid,
      );
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
        protocol === "B"
          ? `Protocol B blocked / failed: ${msg}`
          : msg,
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

  return (
    <Card className="border-emerald-200/80 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-950 to-emerald-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-200/90 uppercase">
              Live participant mode · wallet actions
            </p>
            <CardTitle className="mt-1 text-xl text-white">
              Connect, sign, finance on testnet
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm text-emerald-100/85">
              Real txs from your browser wallet. Supplier registers, obligor
              signs EIP-712, any connected wallet can call Protocol A/B
              adapters. Cleanverse gates run when{" "}
              <code className="text-emerald-200">LIEN_TRUST_MODE=live</code>.
            </p>
          </div>
          <ConnectButton
            chainStatus="icon"
            accountStatus="address"
            showBalance={false}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={lien.ready || stack?.ready ? "default" : "secondary"}>
            {lien.ready || stack?.ready ? "Contracts configured" : "Missing addresses"}
          </Badge>
          <Badge variant="outline">
            API chain {stack?.chainId ?? "—"} · trust {stack?.trustMode ?? "—"}
          </Badge>
          <Badge variant="outline">
            wallet {lien.isConnected ? short(lien.address) : "not connected"}
          </Badge>
          {status && (
            <Badge
              className={cn(
                status.stateLabel === "Encumbered" && "bg-amber-100 text-amber-900",
              )}
              variant="outline"
            >
              {status.stateLabel}
            </Badge>
          )}
        </div>

        {wrongChain && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Switch wallet network to chain {stack?.chainId} (Sepolia for live).
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => void lien.ensureChain()}
            >
              Switch
            </Button>
          </div>
        )}

        {gateNote && (
          <p className="text-xs text-muted-foreground">{gateNote}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Supplier address</Label>
            <Input
              value={supplierInput}
              onChange={(e) => setSupplierInput(e.target.value)}
              placeholder="0x… supplier"
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!lien.address}
              onClick={() => lien.address && setSupplierInput(lien.address)}
            >
              Use connected
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Obligor address</Label>
            <Input
              value={obligorInput}
              onChange={(e) => setObligorInput(e.target.value)}
              placeholder="0x… obligor (second wallet)"
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!lien.address}
              onClick={() => lien.address && setObligorInput(lien.address)}
            >
              Use connected
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Borrower (finance recipient)</Label>
            <Input
              value={borrowerInput}
              onChange={(e) => setBorrowerInput(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice reference</Label>
            <Input
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Face value (dUSDC 6 decimals)</Label>
            <Input
              value={faceValue}
              onChange={(e) => setFaceValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Finance amount</Label>
            <Input
              value={financeAmount}
              onChange={(e) => setFinanceAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs">
          <div className="font-medium">Obligation</div>
          <div className="mt-1 font-mono break-all">
            {obligationId ?? "Prepare terms to derive ID"}
          </div>
          {terms && (
            <div className="mt-2 text-muted-foreground">
              evidence {short(terms.evidenceRoot)} · nonce {short(terms.nonce)}
              {obligorSig ? " · obligor sig ready" : ""}
            </div>
          )}
          {lastTx && stack && (
            <a
              className="mt-2 inline-flex items-center gap-1 text-emerald-800 underline"
              href={txUrl(
                lien.config.explorerBase,
                lastTx,
              )}
              target="_blank"
              rel="noreferrer"
            >
              Last tx {short(lastTx)}
            </a>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            disabled={!!busy || !lien.isConnected}
            onClick={() => void onPrepare()}
          >
            {busy === "prepare" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            1 · Prepare terms
          </Button>
          <Button
            disabled={!!busy || !terms || !lien.isConnected}
            onClick={() => void onRegister()}
          >
            {busy === "register" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            2 · Register (supplier)
          </Button>
          <Button
            disabled={!!busy || !terms || !lien.isConnected}
            onClick={() => void onSignObligor()}
          >
            {busy === "sign" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            3 · Sign (obligor)
          </Button>
          <Button
            disabled={!!busy || !terms || !obligorSig || !lien.isConnected}
            onClick={() => void onConfirm()}
          >
            {busy === "confirm" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            4 · Confirm on-chain
          </Button>
          <Button
            disabled={!!busy || !obligationId || !lien.isConnected}
            onClick={() => void onFinance("A")}
          >
            {busy === "financeA" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            5 · Finance Protocol A
          </Button>
          <Button
            variant="destructive"
            disabled={!!busy || !obligationId || !lien.isConnected}
            onClick={() => void onFinance("B")}
          >
            {busy === "financeB" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            6 · Attack Protocol B
          </Button>
          <Button
            variant="secondary"
            disabled={!!busy || !obligationId || !lien.isConnected}
            onClick={() => void onRepay()}
          >
            {busy === "repay" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            7 · Repay & discharge
          </Button>
          <Button
            variant="outline"
            disabled={!!busy || !obligationId || !lien.isConnected}
            onClick={() => void onSubordinate()}
          >
            {busy === "sub" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Subordinate claim
          </Button>
          <Button
            variant="outline"
            disabled={!!busy || !obligationId || !lien.isConnected}
            onClick={() => void onXchain()}
          >
            {busy === "xchain" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Cross-chain mock
          </Button>
        </div>

        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Multi-wallet tip:</strong> Use
          two browser profiles (or switch accounts). Profile 1 = supplier
          (prepare + register + confirm). Profile 2 = obligor (sign only). Any
          profile can call Finance A then B. Protocol B should revert if A
          already encumbered.
        </div>
      </CardContent>
    </Card>
  );
}
