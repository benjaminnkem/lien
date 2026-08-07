import { keccak256, stringToHex, type Hex } from "viem";
import type { AssetClass } from "./asset-classes";

/**
 * P2 — richer attestation adapters (pluggable).
 * Each adapter produces a commitment hash for audit / export.
 * Adapters do not replace on-chain EIP-712 obligor confirmation.
 */

export type AttestationKind =
  | "obligor_eip712"
  | "supplier_statement"
  | "evidence_root"
  | "cleanverse_cvi"
  | "asset_class_declaration"
  | "cross_chain_clearance";

export type AttestationResult = {
  kind: AttestationKind;
  adapter: string;
  commitment: Hex;
  payload: Record<string, unknown>;
  privacySafe: boolean;
};

export interface AttestationAdapter {
  readonly name: string;
  readonly kind: AttestationKind;
  attest(input: Record<string, unknown>): AttestationResult;
}

function commit(adapter: string, kind: string, body: string): Hex {
  return keccak256(stringToHex(`${adapter}|${kind}|${body}`));
}

export class EvidenceRootAdapter implements AttestationAdapter {
  readonly name = "EvidenceRootAdapter";
  readonly kind = "evidence_root" as const;

  attest(input: Record<string, unknown>): AttestationResult {
    const content = String(input.content ?? "");
    const root =
      typeof input.evidenceRoot === "string" &&
      input.evidenceRoot.startsWith("0x")
        ? (input.evidenceRoot as Hex)
        : keccak256(stringToHex(content));
    return {
      kind: this.kind,
      adapter: this.name,
      commitment: root,
      payload: {
        evidenceRoot: root,
        contentLength: content.length,
        // raw content omitted for privacy by default
      },
      privacySafe: true,
    };
  }
}

export class SupplierStatementAdapter implements AttestationAdapter {
  readonly name = "SupplierStatementAdapter";
  readonly kind = "supplier_statement" as const;

  attest(input: Record<string, unknown>): AttestationResult {
    const supplier = String(input.supplier ?? "");
    const statement = String(
      input.statement ?? "Supplier attests economic terms are accurate",
    );
    const invoiceReference = String(input.invoiceReference ?? "");
    const body = `${supplier}|${invoiceReference}|${statement}`;
    return {
      kind: this.kind,
      adapter: this.name,
      commitment: commit(this.name, this.kind, body),
      payload: { supplier, invoiceReference, statement },
      privacySafe: false,
    };
  }
}

export class AssetClassDeclarationAdapter implements AttestationAdapter {
  readonly name = "AssetClassDeclarationAdapter";
  readonly kind = "asset_class_declaration" as const;

  attest(input: Record<string, unknown>): AttestationResult {
    const assetClass = String(input.assetClass ?? "invoice") as AssetClass;
    const obligationId = String(input.obligationId ?? "");
    const body = `${assetClass}|${obligationId}`;
    return {
      kind: this.kind,
      adapter: this.name,
      commitment: commit(this.name, this.kind, body),
      payload: { assetClass, obligationId },
      privacySafe: true,
    };
  }
}

export class CleanverseCviAttestationAdapter implements AttestationAdapter {
  readonly name = "CleanverseCviAttestationAdapter";
  readonly kind = "cleanverse_cvi" as const;

  attest(input: Record<string, unknown>): AttestationResult {
    const address = String(input.address ?? "");
    const role = String(input.role ?? "");
    const source = String(input.source ?? "unknown");
    const eligible = Boolean(input.eligible);
    const body = `${address}|${role}|${source}|${eligible ? 1 : 0}`;
    return {
      kind: this.kind,
      adapter: this.name,
      commitment: commit(this.name, this.kind, body),
      payload: {
        address,
        role,
        source,
        eligible,
        labeledMock: Boolean(input.labeledMock),
      },
      privacySafe: false,
    };
  }
}

export class CrossChainClearanceAttestationAdapter
  implements AttestationAdapter
{
  readonly name = "CrossChainClearanceAttestationAdapter";
  readonly kind = "cross_chain_clearance" as const;

  attest(input: Record<string, unknown>): AttestationResult {
    const obligationId = String(input.obligationId ?? "");
    const sourceChainId = String(input.sourceChainId ?? "");
    const targetChainId = String(input.targetChainId ?? "");
    const clearanceHash = String(input.clearanceHash ?? "");
    const body = `${obligationId}|${sourceChainId}|${targetChainId}|${clearanceHash}`;
    return {
      kind: this.kind,
      adapter: this.name,
      commitment: commit(this.name, this.kind, body),
      payload: {
        obligationId,
        sourceChainId,
        targetChainId,
        clearanceHash,
        note: "Architecture mock — not a production bridge",
      },
      privacySafe: true,
    };
  }
}

export const defaultAttestationAdapters: AttestationAdapter[] = [
  new EvidenceRootAdapter(),
  new SupplierStatementAdapter(),
  new AssetClassDeclarationAdapter(),
  new CleanverseCviAttestationAdapter(),
  new CrossChainClearanceAttestationAdapter(),
];

export function runAttestationSuite(
  inputs: Array<{ adapter: AttestationAdapter; input: Record<string, unknown> }>,
): AttestationResult[] {
  return inputs.map(({ adapter, input }) => adapter.attest(input));
}
