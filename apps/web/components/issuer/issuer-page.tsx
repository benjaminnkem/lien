"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CopyButton } from "@/components/copy-button";
import { DemoProgress } from "@/components/demo-progress";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  useCheckEncumbrance,
  useCreateFingerprint,
  useDemoConfig,
  useIssueCva,
  useRefreshCva,
} from "@/hooks/use-assets";
import { useConnectedWallet } from "@/hooks/use-connected-wallet";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import type {
  EncumbranceResult,
  FingerprintResult,
  IssueCvaResult,
} from "@/lib/asset-types";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/stores/demo-store";

const invoiceSchema = z.object({
  issuerCvi: z.string().min(3, "Enter the issuer CVI reference"),
  debtorCvi: z.string().min(3, "Enter the debtor CVI reference"),
  documentHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Use a 32-byte 0x-prefixed document hash"),
  invoiceNumber: z.string().min(3, "Enter an invoice number"),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Enter a valid decimal amount"),
  currency: z.string().length(3, "Use a 3-letter currency code"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  chain: z.string().min(1),
  issuerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Connect an issuer wallet"),
  atokenAddress: z.string().min(8, "Enter the A-Token address"),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

const defaultHash =
  "0x9b1e2d87d763bb9b98b1f437d793934e3923529cfef2d00ad5dfcd4b6bf88a10";

function createInvoiceNumber() {
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `INV-2026-${suffix}`;
}

export function IssuerPage() {
  const createFingerprint = useCreateFingerprint();
  const checkEncumbrance = useCheckEncumbrance();
  const issueCva = useIssueCva();
  const refreshCva = useRefreshCva();
  const demoConfig = useDemoConfig();
  const { address, isConnected } = useConnectedWallet();
  const [fingerprintResult, setFingerprintResult] =
    useState<FingerprintResult | null>(null);
  const [registryResult, setRegistryResult] =
    useState<EncumbranceResult | null>(null);
  const [cvaResult, setCvaResult] = useState<IssueCvaResult | null>(null);
  const demoInvoiceNumber = useDemoStore((state) => state.invoiceNumber);
  const setAsset = useDemoStore((state) => state.setAsset);
  const markClean = useDemoStore((state) => state.markClean);
  const resetDemo = useDemoStore((state) => state.reset);

  const form = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      issuerCvi: "cvi:issuer:atlas-manufacturing",
      debtorCvi: "cvi:debtor:northline-retail",
      documentHash: defaultHash,
      invoiceNumber: demoInvoiceNumber ?? "INV-2026-DEMO",
      amount: "128500.00",
      currency: "USD",
      dueDate: "2026-12-18",
      chain: "ethereum",
      issuerWallet: "",
      atokenAddress: "",
    },
  });

  useEffect(() => {
    form.setValue("invoiceNumber", demoInvoiceNumber ?? createInvoiceNumber());
  }, [demoInvoiceNumber, form]);

  useEffect(() => {
    const config = demoConfig.data;
    if (!config) return;
    form.setValue("chain", config.chain);
    form.setValue("issuerCvi", config.parties.issuer.cvi);
    form.setValue("debtorCvi", config.debtorCvi);
    if (config.atokenAddress) {
      form.setValue("atokenAddress", config.atokenAddress);
    }
  }, [demoConfig.data, form]);

  useEffect(() => {
    if (address) {
      form.setValue("issuerWallet", address, { shouldValidate: true });
    } else {
      form.setValue("issuerWallet", "", { shouldValidate: true });
    }
  }, [address, form]);

  const isSubmitting =
    createFingerprint.isPending || checkEncumbrance.isPending;
  const canSubmit = isConnected && Boolean(address);

  async function submit(values: InvoiceForm) {
    if (!address) {
      toast.error("Connect a wallet", {
        description:
          "Issuer A-Pass is verified against the wallet connected in the browser.",
      });
      return;
    }

    setFingerprintResult(null);
    setRegistryResult(null);
    setCvaResult(null);

    try {
      const created = await createFingerprint.mutateAsync({
        ...values,
        issuerWallet: address,
        currency: values.currency.toUpperCase(),
      });
      setFingerprintResult(created);
      setAsset(created.fingerprint, created.fields.invoiceNumber);

      const checked = await checkEncumbrance.mutateAsync(created.fingerprint);
      setRegistryResult(checked);

      if (checked.isClean) {
        markClean();
        toast.success("Registry check passed", {
          description:
            "Fingerprint is clean. Next: issue it as a Cleanverse CVA before financing.",
        });
      } else {
        toast.warning("Existing claim detected", {
          description: checked.reason,
        });
      }
    } catch (error) {
      const cviBlocked =
        error instanceof ApiError && error.code?.startsWith("CVI_");
      toast.error(
        cviBlocked
          ? "Issuer CVI verification failed"
          : "Could not register the invoice",
        {
          description: getApiErrorMessage(error),
        },
      );
    }
  }

  function startFresh() {
    resetDemo();
    setFingerprintResult(null);
    setRegistryResult(null);
    setCvaResult(null);
    form.reset({
      ...form.getValues(),
      invoiceNumber: createInvoiceNumber(),
      issuerWallet: address ?? "",
    });
    toast.info("Fresh invoice ready");
  }

  async function mintAsCva() {
    if (!fingerprintResult || !registryResult?.isClean) return;
    try {
      const issued = await issueCva.mutateAsync({
        fingerprint: fingerprintResult.fingerprint,
        adminAddress: address ?? undefined,
      });
      setCvaResult(issued);
      if (issued.status === "minted") {
        toast.success("CVA minted", {
          description: `Cleanverse issued ${issued.cva.symbol ?? "A-Token"} for this receivable.`,
        });
      } else if (issued.pending) {
        toast.message("CVA issuance pending", {
          description: "Polling Cleanverse apply status…",
        });
      }
    } catch (error) {
      toast.error("CVA issuance failed", {
        description: getApiErrorMessage(error),
      });
    }
  }

  async function pollCva() {
    if (!fingerprintResult) return;
    try {
      const issued = await refreshCva.mutateAsync(
        fingerprintResult.fingerprint,
      );
      setCvaResult(issued);
      if (issued.status === "minted") {
        toast.success("CVA minted", {
          description: issued.cva.atokenAddress ?? "A-Token issued",
        });
      } else {
        toast.message("Still processing", {
          description: issued.cva.applyStatus ?? "PENDING",
        });
      }
    } catch (error) {
      toast.error("Could not refresh CVA status", {
        description: getApiErrorMessage(error),
      });
    }
  }

  const cvaMinted =
    cvaResult?.status === "minted" ||
    fingerprintResult?.status === "minted";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <DemoProgress />

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.28fr)_minmax(20rem,0.72fr)] lg:gap-8">
        <div>
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-emerald-700 uppercase">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
                  01
                </span>
                Issuer workspace
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Register the receivable.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Canonical invoice fields become one deterministic
                fingerprint—without placing raw business data in the shared
                registry.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={startFresh}
              className="self-start bg-white/60 sm:self-auto"
            >
              <RefreshCw />
              Fresh invoice
            </Button>
          </div>

          <Card className="border-border/70 bg-card/90 py-0 shadow-[0_26px_80px_-55px_rgba(15,23,42,0.75)]">
            <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Invoice identity</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Required fields are normalized before hashing.
                  </p>
                </div>
                <StatusBadge label="Server-side registry" tone="clean" />
              </div>
            </CardHeader>
            <CardContent className="px-5 py-6 sm:px-7 sm:py-7">
              <form onSubmit={form.handleSubmit(submit)} noValidate>
                <FieldGroup className="gap-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      data-invalid={Boolean(
                        form.formState.errors.invoiceNumber,
                      )}
                    >
                      <FieldLabel htmlFor="invoice-number">
                        Invoice number
                      </FieldLabel>
                      <Input
                        id="invoice-number"
                        data-testid="invoice-number"
                        placeholder="INV-2026-001"
                        aria-invalid={Boolean(
                          form.formState.errors.invoiceNumber,
                        )}
                        {...form.register("invoiceNumber")}
                      />
                      <FieldError
                        errors={[form.formState.errors.invoiceNumber]}
                      />
                    </Field>
                    <div className="grid grid-cols-[1fr_7rem] gap-3">
                      <Field
                        data-invalid={Boolean(form.formState.errors.amount)}
                      >
                        <FieldLabel htmlFor="amount">Face value</FieldLabel>
                        <Input
                          id="amount"
                          data-testid="invoice-amount"
                          inputMode="decimal"
                          aria-invalid={Boolean(form.formState.errors.amount)}
                          {...form.register("amount")}
                        />
                        <FieldError errors={[form.formState.errors.amount]} />
                      </Field>
                      <Field
                        data-invalid={Boolean(form.formState.errors.currency)}
                      >
                        <FieldLabel htmlFor="currency">Currency</FieldLabel>
                        <Input
                          id="currency"
                          className="uppercase"
                          maxLength={3}
                          aria-invalid={Boolean(form.formState.errors.currency)}
                          {...form.register("currency")}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      data-invalid={Boolean(form.formState.errors.dueDate)}
                    >
                      <FieldLabel htmlFor="due-date">Due date</FieldLabel>
                      <Input
                        id="due-date"
                        type="date"
                        aria-invalid={Boolean(form.formState.errors.dueDate)}
                        {...form.register("dueDate")}
                      />
                      <FieldError errors={[form.formState.errors.dueDate]} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="chain">
                        Settlement network
                      </FieldLabel>
                      <NativeSelect
                        className="w-full"
                        id="chain"
                        {...form.register("chain")}
                      >
                        <NativeSelectOption value="ethereum">
                          Ethereum (Sepolia UAT)
                        </NativeSelectOption>
                        <NativeSelectOption value="base">
                          Base
                        </NativeSelectOption>
                        <NativeSelectOption value="arbitrum">
                          Arbitrum
                        </NativeSelectOption>
                        <NativeSelectOption value="polygon">
                          Polygon
                        </NativeSelectOption>
                        <NativeSelectOption value="monad">
                          Monad
                        </NativeSelectOption>
                      </NativeSelect>
                      <FieldDescription>
                        CVI settlement network for this submission. The asset
                        fingerprint is chain-agnostic — a lien on one network
                        blocks every other network.
                      </FieldDescription>
                    </Field>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-[0.13em] text-muted-foreground uppercase">
                        Cleanverse identity gate
                      </p>
                      <StatusBadge
                        label={
                          fingerprintResult?.issuerVerification
                            ? "CVI verified"
                            : isConnected
                              ? "Wallet connected"
                              : "Connect wallet"
                        }
                        tone={
                          fingerprintResult?.issuerVerification
                            ? "clean"
                            : isConnected
                              ? "clean"
                              : "neutral"
                        }
                      />
                    </div>
                    <div className="mb-5 rounded-2xl border border-border/70 bg-background/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                            Connected issuer wallet
                          </p>
                          <p className="mt-1 font-mono text-xs break-all">
                            {address ?? "No wallet connected"}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            Cleanverse A-Pass is checked against this address.
                            Switch account in your wallet to act as a different
                            issuer.
                          </p>
                        </div>
                        <ConnectButton
                          showBalance={false}
                          chainStatus="icon"
                          accountStatus="address"
                        />
                      </div>
                      <input type="hidden" {...form.register("issuerWallet")} />
                      <FieldError
                        errors={[form.formState.errors.issuerWallet]}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field
                        data-invalid={Boolean(form.formState.errors.issuerCvi)}
                      >
                        <FieldLabel htmlFor="issuer-cvi">Issuer CVI</FieldLabel>
                        <Input
                          id="issuer-cvi"
                          data-testid="issuer-cvi"
                          aria-invalid={Boolean(
                            form.formState.errors.issuerCvi,
                          )}
                          {...form.register("issuerCvi")}
                        />
                        <FieldError
                          errors={[form.formState.errors.issuerCvi]}
                        />
                      </Field>
                      <Field
                        data-invalid={Boolean(form.formState.errors.debtorCvi)}
                      >
                        <FieldLabel htmlFor="debtor-cvi">Debtor CVI</FieldLabel>
                        <Input
                          id="debtor-cvi"
                          aria-invalid={Boolean(
                            form.formState.errors.debtorCvi,
                          )}
                          {...form.register("debtorCvi")}
                        />
                        <FieldError
                          errors={[form.formState.errors.debtorCvi]}
                        />
                      </Field>
                    </div>
                    <div className="mt-5">
                      <Field
                        data-invalid={Boolean(
                          form.formState.errors.atokenAddress,
                        )}
                      >
                        <FieldLabel htmlFor="atoken-address">
                          Verification A-Token
                        </FieldLabel>
                        <Input
                          id="atoken-address"
                          data-testid="atoken-address"
                          className="font-mono text-xs"
                          placeholder="0x…"
                          aria-invalid={Boolean(
                            form.formState.errors.atokenAddress,
                          )}
                          {...form.register("atokenAddress")}
                        />
                        <FieldDescription>
                          Public Cleanverse A-Token used for verify_apass.
                        </FieldDescription>
                        <FieldError
                          errors={[form.formState.errors.atokenAddress]}
                        />
                      </Field>
                    </div>
                    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                      <WalletCards className="mt-0.5 size-3.5 shrink-0" />
                      The API runs queryApass and verifyApass before creating
                      the fingerprint. Cleanverse credentials never enter the
                      browser.
                    </p>
                  </div>

                  <Field
                    data-invalid={Boolean(form.formState.errors.documentHash)}
                  >
                    <FieldLabel htmlFor="document-hash">
                      Document checksum
                    </FieldLabel>
                    <Input
                      id="document-hash"
                      className="font-mono text-xs"
                      aria-invalid={Boolean(form.formState.errors.documentHash)}
                      {...form.register("documentHash")}
                    />
                    <FieldDescription>
                      The invoice file stays private; only its hash enters the
                      fingerprint.
                    </FieldDescription>
                    <FieldError errors={[form.formState.errors.documentHash]} />
                  </Field>

                  <Button
                    data-testid="create-fingerprint"
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || !canSubmit}
                    className="mt-1 h-12 w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="animate-spin" />
                        {createFingerprint.isPending
                          ? "Creating fingerprint…"
                          : "Checking registry…"}
                      </>
                    ) : !canSubmit ? (
                      <>
                        <WalletCards />
                        Connect wallet to continue
                      </>
                    ) : (
                      <>
                        <Fingerprint />
                        Fingerprint & check registry
                      </>
                    )}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:pt-[9.8rem]">
          <Card className="border-border/70 bg-[#102a26] text-white shadow-[0_30px_80px_-50px_rgba(9,35,31,0.95)] ring-0">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-200/65 uppercase">
                    Proof pipeline
                  </p>
                  <CardTitle className="mt-2 text-lg text-white">
                    Invoice integrity
                  </CardTitle>
                </div>
                <span className="flex size-10 items-center justify-center rounded-2xl bg-white/8 text-emerald-200 ring-1 ring-white/10">
                  <ShieldCheck className="size-5" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {[
                  {
                    title: "Verify issuer A-Pass",
                    body: "Confirm the CVI is active and eligible for this A-Token.",
                    done: Boolean(fingerprintResult?.issuerVerification),
                    icon: ShieldCheck,
                  },
                  {
                    title: "Canonicalize fields",
                    body: "Normalize parties, amount, currency, and dates.",
                    done: Boolean(fingerprintResult),
                    icon: FileCheck2,
                  },
                  {
                    title: "Keccak fingerprint",
                    body: "Create a deterministic 32-byte asset identity.",
                    done: Boolean(fingerprintResult),
                    icon: Fingerprint,
                  },
                  {
                    title: "Registry lookup",
                    body: "Check for an active first-priority claim.",
                    done: Boolean(registryResult),
                    icon: SearchCheck,
                  },
                  {
                    title: "Mint as CVA",
                    body: "Cleanverse A-Token launch after clean check.",
                    done: cvaMinted,
                    icon: ShieldCheck,
                  },
                ].map((step, index, all) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/45 transition-colors",
                            step.done &&
                              "border-emerald-300/40 bg-emerald-300 text-[#102a26]",
                          )}
                        >
                          {step.done ? (
                            <Check className="size-4" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                        </span>
                        {index < all.length - 1 && (
                          <span className="h-10 w-px bg-white/10" />
                        )}
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-100/48">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <AnimatePresence mode="wait">
            {fingerprintResult && registryResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              >
                <Card
                  data-testid="registry-result"
                  className={cn(
                    "border-emerald-200 bg-emerald-50/90 ring-0",
                    !registryResult.isClean && "border-rose-200 bg-rose-50/90",
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <StatusBadge
                          label={
                            registryResult.isClean
                              ? "Registry clean"
                              : "Claim found"
                          }
                          tone={registryResult.isClean ? "clean" : "blocked"}
                        />
                        <CardTitle className="mt-4 text-xl">
                          {!registryResult.isClean
                            ? "Already encumbered"
                            : cvaMinted
                              ? "CVA minted — ready to finance"
                              : "Ready to mint as CVA"}
                        </CardTitle>
                      </div>
                      <span
                        className={cn(
                          "flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white",
                          !registryResult.isClean && "bg-rose-600",
                        )}
                      >
                        {registryResult.isClean ? <Check /> : <CircleAlert />}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {registryResult.reason}
                    </p>
                    <div className="rounded-xl border border-black/5 bg-white/65 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                          Asset fingerprint
                        </span>
                        <CopyButton
                          value={fingerprintResult.fingerprint}
                          label="Copy"
                        />
                      </div>
                      <p className="mt-2 break-all font-mono text-[11px] leading-5">
                        {fingerprintResult.fingerprint}
                      </p>
                    </div>
                    {registryResult.isClean && !cvaMinted && (
                      <Button
                        type="button"
                        size="lg"
                        className="h-11 w-full"
                        disabled={issueCva.isPending || refreshCva.isPending}
                        onClick={mintAsCva}
                        data-testid="issue-cva"
                      >
                        {issueCva.isPending ? (
                          <>
                            <LoaderCircle className="animate-spin" />
                            Issuing CVA via Cleanverse…
                          </>
                        ) : (
                          <>
                            <ShieldCheck />
                            Issue as Cleanverse CVA
                          </>
                        )}
                      </Button>
                    )}
                    {cvaResult?.pending && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full"
                        disabled={refreshCva.isPending}
                        onClick={pollCva}
                      >
                        {refreshCva.isPending ? (
                          <LoaderCircle className="animate-spin" />
                        ) : null}
                        Refresh CVA status ({cvaResult.cva.applyStatus ?? "PENDING"})
                      </Button>
                    )}
                    {cvaMinted && cvaResult && (
                      <div className="space-y-2 rounded-xl border border-emerald-200 bg-white/70 p-3 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Status</span>
                          <StatusBadge label="minted" tone="clean" />
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Symbol</span>
                          <span className="font-medium">
                            {cvaResult.cva.symbol ?? "—"}
                          </span>
                        </div>
                        <div className="break-all font-mono text-[10px] text-muted-foreground">
                          {cvaResult.cva.atokenAddress}
                        </div>
                        {cvaResult.cva.explorerUrl && (
                          <a
                            href={cvaResult.cva.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-emerald-800 underline-offset-2 hover:underline"
                          >
                            View issuance tx
                          </a>
                        )}
                      </div>
                    )}
                    {cvaMinted && (
                      <Link
                        href="/lender"
                        className={cn(
                          buttonVariants({ size: "lg" }),
                          "h-11 w-full",
                        )}
                      >
                        Continue to Lender
                        <ArrowRight />
                      </Link>
                    )}
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white/65 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">
                        Issuer identity
                      </span>
                      <StatusBadge label="CVI verified" tone="clean" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Card className="border-dashed bg-white/45">
                  <CardContent className="flex min-h-40 flex-col items-center justify-center text-center">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Fingerprint className="size-4" />
                    </span>
                    <p className="mt-3 text-sm font-medium">
                      Your proof appears here
                    </p>
                    <p className="mt-1 max-w-[15rem] text-xs leading-5 text-muted-foreground">
                      Submit the invoice to create its fingerprint and registry
                      evidence.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
