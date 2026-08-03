import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAssetFingerprint } from "@repo/sdk";
import { ApiStatus } from "@/components/api-status";

const demoFingerprint = createAssetFingerprint({
  issuerCvi: "cvi:issuer:demo-001",
  debtorCvi: "cvi:debtor:demo-001",
  documentHash:
    "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  invoiceNumber: "INV-2026-0001",
  amount: "100000.00",
  currency: "USD",
  dueDate: "2026-12-31",
});

const steps = [
  {
    title: "Fingerprint",
    body: "Hash issuer CVI, debtor CVI, document, invoice number, amount, and due date into a privacy-preserving Asset Fingerprint.",
  },
  {
    title: "Check Registry",
    body: "Query the shared Encumbrance Registry for existing liens or conflicting claims on the same underlying asset.",
  },
  {
    title: "Mint CVA",
    body: "Only if clean: mint a Cleanverse Verified Asset (CVA) as the sole on-chain representation.",
  },
  {
    title: "Register Lien",
    body: "On financing, record a first-priority lien and block any future re-tokenization or re-pledge attempts.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="mb-12 max-w-3xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wider text-teal-700 dark:text-teal-400">
          Cleanverse Hackathon · RWA Track
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Lien
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Pre-mint and pre-collateralization firewall for Real-World Assets.
          Stop the same invoice from being tokenized or pledged twice across
          platforms and chains — powered by Cleanverse CVI and CVA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled title="Coming next">
            Issuer dashboard
          </Button>
          <Button variant="outline" disabled title="Coming next">
            Lender dashboard
          </Button>
        </div>
      </section>

      <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <Card key={step.title}>
            <CardHeader>
              <CardDescription>Step {i + 1}</CardDescription>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SDK smoke check</CardTitle>
            <CardDescription>
              Shared <code className="text-xs">@repo/sdk</code> fingerprint
              utility (demo invoice)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
              {demoFingerprint}
            </code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API status</CardTitle>
            <CardDescription>
              NestJS health endpoint at{" "}
              <code className="text-xs">/api/health</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiStatus />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
