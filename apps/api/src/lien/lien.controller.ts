import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { Hex } from "viem";
import type { PrivacyLevel } from "lien-sdk";
import { LienService } from "./lien.service";

@ApiTags("lien")
@Controller("lien")
export class LienController {
  constructor(private readonly lien: LienService) {}

  @Get("status")
  @ApiOperation({ summary: "LienGuard stack + trust mode status" })
  status() {
    return this.lien.getStatus();
  }

  @Post("preview-ids")
  @ApiOperation({
    summary: "Show different evidence hashes resolve to the same Obligation ID",
  })
  preview(@Body() body: Record<string, unknown>) {
    return this.lien.previewIds({
      supplier: String(body.supplier),
      obligor: String(body.obligor),
      currency: String(body.currency ?? "USD"),
      faceValue: String(body.faceValue),
      dueDate: Number(body.dueDate),
      invoiceReference: String(body.invoiceReference),
      purchaseOrderReference: body.purchaseOrderReference
        ? String(body.purchaseOrderReference)
        : "",
      evidenceContentA: String(body.evidenceContentA),
      evidenceContentB: String(body.evidenceContentB),
      jurisdiction: body.jurisdiction ? String(body.jurisdiction) : "SG",
      nonce: String(body.nonce ?? "demo-nonce"),
    });
  }

  @Get("audit")
  @ApiOperation({ summary: "Append-only LIEN audit trail" })
  audit(@Query("obligationId") obligationId?: string) {
    return this.lien.getAudit(obligationId);
  }

  @Get("obligations/:id/graph")
  @ApiOperation({ summary: "Claim graph nodes derived from audit trail" })
  claimGraph(@Param("id") id: string) {
    return this.lien.getClaimGraph(id);
  }

  @Get("obligations/:id/export")
  @ApiOperation({
    summary: "Evidence pack (format=json|csv, privacy=public|redacted|commitments_only)",
  })
  async exportPack(
    @Param("id") id: string,
    @Query("format") format: string | undefined,
    @Query("privacy") privacy: string | undefined,
    @Res() res: Response,
  ) {
    const fmt = format?.toLowerCase() === "csv" ? "csv" : "json";
    const privacyLevel = (
      ["public", "redacted", "commitments_only"].includes(privacy ?? "")
        ? privacy
        : "public"
    ) as PrivacyLevel;
    const pack = await this.lien.exportEvidencePack(
      id as Hex,
      fmt,
      privacyLevel,
    );
    if (pack.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${pack.filename}"`,
      );
      return res.send(pack.content);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="lien-evidence-${id.slice(0, 10)}.json"`,
    );
    return res.json(pack);
  }

  @Get("obligations/:id/claims")
  @ApiOperation({ summary: "P2: list subordinate / disclosed priority claims" })
  listClaims(@Param("id") id: string) {
    return this.lien.listSubordinateClaims(id as Hex);
  }

  @Post("obligations/:id/claims/subordinate")
  @ApiOperation({
    summary:
      "P2: register subordinate claim (rank>=1, protocol-level priority only)",
  })
  registerSubordinate(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lien.registerSubordinateClaim({
      obligationId: id as Hex,
      priorityRank: Number(body.priorityRank ?? 1),
      amount: String(body.amount),
      label: body.label ? String(body.label) : undefined,
      claimRef: body.claimRef ? String(body.claimRef) : undefined,
    });
  }

  @Post("claims/:claimId/release")
  @ApiOperation({ summary: "P2: release subordinate claim" })
  releaseClaim(
    @Param("claimId") claimId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.lien.releaseSubordinateClaim(
      claimId as Hex,
      String(body.obligationId) as Hex,
    );
  }

  @Get("obligations/:id")
  @ApiOperation({ summary: "Read obligation + encumbrance status" })
  getOne(@Param("id") id: string) {
    return this.lien.getObligation(id as Hex);
  }

  @Post("obligations/register")
  @ApiOperation({
    summary: "Register + confirm obligation (supplier + obligor EIP-712 sig)",
  })
  register(@Body() body: Record<string, unknown>) {
    return this.lien.registerAndConfirm({
      supplier: String(body.supplier),
      obligor: String(body.obligor),
      currency: String(body.currency ?? "USD"),
      faceValue: String(body.faceValue),
      dueDate: Number(body.dueDate),
      invoiceReference: String(body.invoiceReference),
      purchaseOrderReference: body.purchaseOrderReference
        ? String(body.purchaseOrderReference)
        : "",
      evidenceContent: String(body.evidenceContent),
      evidenceContentB: body.evidenceContentB
        ? String(body.evidenceContentB)
        : undefined,
      jurisdiction: body.jurisdiction ? String(body.jurisdiction) : "SG",
      supplierWallet: String(body.supplierWallet ?? body.supplier),
      obligorSignature: String(body.obligorSignature) as Hex,
      nonce: body.nonce ? (String(body.nonce) as Hex) : undefined,
      chain: body.chain ? String(body.chain) : "ethereum",
      atokenAddress: body.atokenAddress
        ? String(body.atokenAddress)
        : undefined,
    });
  }

  @Post("protocols/:which/finance")
  @ApiOperation({
    summary:
      "Finance via DemoFinanceA or DemoFinanceB (CVI/CCP gated, independent adapters)",
  })
  finance(
    @Param("which") which: string,
    @Body() body: Record<string, unknown>,
  ) {
    const protocol = which.toUpperCase() === "B" ? "B" : "A";
    return this.lien.financeWithProtocol(protocol, {
      obligationId: String(body.obligationId) as Hex,
      borrower: String(body.borrower),
      amount: String(body.amount),
      reservationSeconds: body.reservationSeconds
        ? Number(body.reservationSeconds)
        : 3600,
    });
  }

  @Post("protocols/:which/repay")
  @ApiOperation({
    summary: "Repay + discharge encumbrance via Protocol A or B",
  })
  repay(
    @Param("which") which: string,
    @Body() body: Record<string, unknown>,
  ) {
    const protocol = which.toUpperCase() === "B" ? "B" : "A";
    return this.lien.repayWithProtocol(protocol, {
      obligationId: String(body.obligationId) as Hex,
      amount: String(body.amount),
      repaymentRef: body.repaymentRef
        ? String(body.repaymentRef)
        : undefined,
    });
  }

  @Post("demo/seed")
  @ApiOperation({
    summary:
      "Seed Acme/Atlas obligation on local Hardhat (Document A + obligor confirm + trust gates)",
  })
  seedDemo() {
    return this.lien.seedDemo();
  }

  @Post("demo/compliance-fail")
  @ApiOperation({
    summary:
      "P1: force CVI/CCP failure before funds move (no on-chain finance call)",
  })
  complianceFail(@Body() body: Record<string, unknown>) {
    return this.lien.demoComplianceFailure({
      obligationId: String(body.obligationId) as Hex,
      borrower: String(body.borrower),
      protocol: String(body.protocol ?? "B").toUpperCase() === "A" ? "A" : "B",
    });
  }

  @Post("demo/reservation-expiry")
  @ApiOperation({
    summary:
      "P1: reserve → advance Hardhat time → expire (returns to Verified)",
  })
  reservationExpiry(@Body() body: Record<string, unknown>) {
    return this.lien.demoReservationExpiry({
      obligationId: String(body.obligationId) as Hex,
      amount: body.amount ? String(body.amount) : undefined,
      ttlSeconds: body.ttlSeconds ? Number(body.ttlSeconds) : 5,
    });
  }

  @Get("protocols/liquidity")
  @ApiOperation({ summary: "Protocol A/B settlement liquidity" })
  liquidity() {
    return this.lien.protocolBalances();
  }

  @Post("xchain/post")
  @ApiOperation({
    summary: "P2: post mock cross-chain clearance (architecture demo, not a bridge)",
  })
  xchainPost(@Body() body: Record<string, unknown>) {
    return this.lien.postCrossChainClearance({
      obligationId: String(body.obligationId) as Hex,
      targetChainId: Number(body.targetChainId ?? 10142),
      clearanceHash: body.clearanceHash
        ? String(body.clearanceHash)
        : undefined,
    });
  }

  @Post("xchain/consume")
  @ApiOperation({ summary: "P2: one-time consume mock remote clearance" })
  xchainConsume(@Body() body: Record<string, unknown>) {
    return this.lien.consumeCrossChainClearance({
      recordId: String(body.recordId) as Hex,
      obligationId: body.obligationId
        ? (String(body.obligationId) as Hex)
        : undefined,
    });
  }

  @Post("attestations/build")
  @ApiOperation({ summary: "P2: run attestation adapter suite (off-chain commitments)" })
  attestations(@Body() body: Record<string, unknown>) {
    return this.lien.buildAttestationBundle({
      obligationId: body.obligationId ? String(body.obligationId) : undefined,
      supplier: body.supplier ? String(body.supplier) : undefined,
      invoiceReference: body.invoiceReference
        ? String(body.invoiceReference)
        : undefined,
      evidenceContent: body.evidenceContent
        ? String(body.evidenceContent)
        : undefined,
      assetClass: body.assetClass ? String(body.assetClass) : "invoice",
      gates: Array.isArray(body.gates)
        ? (body.gates as Array<Record<string, unknown>>)
        : undefined,
      crossChain: body.crossChain
        ? (body.crossChain as Record<string, unknown>)
        : undefined,
    });
  }

  @Get("analytics")
  @ApiOperation({ summary: "P2: audit analytics summary" })
  analytics() {
    return this.lien.getAnalytics();
  }

  @Post("live/prepare")
  @ApiOperation({
    summary:
      "Live mode: build terms + EIP-712 typed data for wallet register/confirm (no chain write)",
  })
  prepareLive(@Body() body: Record<string, unknown>) {
    return this.lien.prepareLiveObligation({
      supplier: String(body.supplier),
      obligor: String(body.obligor),
      currency: body.currency ? String(body.currency) : "USD",
      faceValue: String(body.faceValue),
      dueDate: Number(body.dueDate),
      invoiceReference: String(body.invoiceReference),
      purchaseOrderReference: body.purchaseOrderReference
        ? String(body.purchaseOrderReference)
        : "",
      evidenceContent: String(body.evidenceContent),
      evidenceContentB: body.evidenceContentB
        ? String(body.evidenceContentB)
        : undefined,
      jurisdiction: body.jurisdiction ? String(body.jurisdiction) : "SG",
      nonce: body.nonce ? String(body.nonce) : undefined,
    });
  }

  @Post("live/cvi-check")
  @ApiOperation({ summary: "Live mode: CVI/CCP gate check for a wallet" })
  cviCheck(@Body() body: Record<string, unknown>) {
    return this.lien.checkParticipantGate(
      String(body.address),
      body.role ? String(body.role) : "participant",
    );
  }

  @Post("live/audit")
  @ApiOperation({
    summary: "Live mode: append client wallet action to audit trail",
  })
  clientAudit(@Body() body: Record<string, unknown>) {
    return this.lien.recordClientAudit({
      obligationId: body.obligationId
        ? String(body.obligationId)
        : undefined,
      eventType: String(body.eventType ?? "CLIENT_ACTION"),
      outcome: String(body.outcome ?? "success"),
      reasonCode: body.reasonCode ? String(body.reasonCode) : undefined,
      payload:
        body.payload && typeof body.payload === "object"
          ? (body.payload as Record<string, unknown>)
          : {},
    });
  }
}
