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
  @ApiOperation({ summary: "Evidence pack (format=json|csv)" })
  async exportPack(
    @Param("id") id: string,
    @Query("format") format: string | undefined,
    @Res() res: Response,
  ) {
    const fmt = format?.toLowerCase() === "csv" ? "csv" : "json";
    const pack = await this.lien.exportEvidencePack(id as Hex, fmt);
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
}
