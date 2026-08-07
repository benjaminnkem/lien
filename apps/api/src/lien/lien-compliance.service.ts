import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { keccak256, stringToHex, type Hex } from "viem";
import { CleanverseService } from "../cleanverse/cleanverse.service";

export type TrustMode = "demo" | "live";

export type ParticipantGate = {
  address: string;
  role: string;
  source: "demo-mock" | "cleanverse-live";
  labeledMock: boolean;
  cvi: {
    eligible: boolean;
    queryStatus?: number;
    verifyCode?: number;
    message: string;
  };
  ccp: {
    allowed: boolean;
    message: string;
  };
  identityChecksHash: Hex;
};

/**
 * Cleanverse trust gates for LIEN P0.
 * - live: real CVI (A-Pass) + CCP-style compliance verify when configured
 * - demo: deterministic labeled mock for local Hardhat (never claimed as live)
 */
@Injectable()
export class LienComplianceService {
  private readonly logger = new Logger(LienComplianceService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cleanverse: CleanverseService,
  ) {}

  get trustMode(): TrustMode {
    const raw = (this.config.get<string>("lien.trustMode") ?? "").toLowerCase();
    if (raw === "live" || raw === "demo") return raw;
    const chainId = Number(
      this.config.get<number>("lien.chainId") ??
        this.config.get<number>("chain.chainId") ??
        31337,
    );
    // Local Hardhat defaults to demo; public chains default to live when Cleanverse configured.
    if (chainId === 31337) return "demo";
    return this.cleanverse.isConfigured ? "live" : "demo";
  }

  get atokenAddress(): string {
    return (
      this.config.get<string>("demo.atokenAddress") ||
      this.config.get<string>("lien.atokenAddress") ||
      ""
    );
  }

  get cleanverseChain(): string {
    return this.config.get<string>("demo.chain") ?? "ethereum";
  }

  get settlementRail() {
    const mode = this.trustMode;
    const token = this.config.get<string>("lien.tokenAddress") ?? "";
    if (mode === "live" && this.atokenAddress) {
      return {
        rail: "cva-protected-intent" as const,
        cvaAtoken: this.atokenAddress,
        settlementToken: token,
        note: "CVI/CCP gates applied; settlement asset is the configured demo token bound to CVA compliance context.",
        labeledMock: false,
      };
    }
    return {
      rail: "demo-settlement-token" as const,
      cvaAtoken: this.atokenAddress || null,
      settlementToken: token,
      note: "Labeled hackathon substitute (dUSDC). Not a live Cleanverse CVA mint.",
      labeledMock: true,
    };
  }

  async gateParticipant(
    address: string,
    role: string,
    opts?: { forceFail?: boolean; failReason?: string },
  ): Promise<ParticipantGate> {
    if (opts?.forceFail) {
      return this.forcedFailGate(
        address,
        role,
        opts.failReason ?? "DEMO_COMPLIANCE_FAILURE",
      );
    }
    if (this.trustMode === "demo") {
      return this.demoGate(address, role);
    }
    return this.liveGate(address, role);
  }

  async gateMany(
    entries: Array<{ address: string; role: string }>,
    opts?: { forceFail?: boolean; failReason?: string },
  ): Promise<ParticipantGate[]> {
    const out: ParticipantGate[] = [];
    for (const e of entries) {
      out.push(await this.gateParticipant(e.address, e.role, opts));
    }
    return out;
  }

  private forcedFailGate(
    address: string,
    role: string,
    reason: string,
  ): ParticipantGate {
    const identityChecksHash = keccak256(
      stringToHex(`force-fail|${role}|${address.toLowerCase()}|${reason}`),
    );
    return {
      address,
      role,
      source: this.trustMode === "live" ? "cleanverse-live" : "demo-mock",
      labeledMock: this.trustMode !== "live",
      cvi: {
        eligible: false,
        queryStatus: 0,
        verifyCode: 3,
        message: `CVI blocked: ${reason}`,
      },
      ccp: {
        allowed: false,
        message: `CCP blocked: ${reason}`,
      },
      identityChecksHash,
    };
  }

  aggregateIdentityHash(gates: ParticipantGate[]): Hex {
    const payload = gates
      .map(
        (g) =>
          `${g.address.toLowerCase()}:${g.role}:${g.cvi.eligible}:${g.ccp.allowed}:${g.identityChecksHash}`,
      )
      .join("|");
    return keccak256(stringToHex(payload));
  }

  assertAllEligible(gates: ParticipantGate[], context: string) {
    for (const g of gates) {
      if (!g.cvi.eligible) {
        throw new BadRequestException({
          message: `${context}: ${g.role} failed CVI gate`,
          code: "IDENTITY_NOT_ELIGIBLE",
          reasonCode: "IDENTITY_NOT_ELIGIBLE",
          gate: g,
        });
      }
      if (!g.ccp.allowed) {
        throw new BadRequestException({
          message: `${context}: ${g.role} failed CCP/compliance gate`,
          code: "COMPLIANCE_BLOCKED",
          reasonCode: "COMPLIANCE_BLOCKED",
          gate: g,
        });
      }
    }
  }

  private demoGate(address: string, role: string): ParticipantGate {
    const identityChecksHash = keccak256(
      stringToHex(
        `demo-mock|cvi|ccp|${role}|${address.toLowerCase()}|eligible=1`,
      ),
    );
    return {
      address,
      role,
      source: "demo-mock",
      labeledMock: true,
      cvi: {
        eligible: true,
        queryStatus: 1,
        verifyCode: 4,
        message: "DEMO_MOCK_CVI_PASS (not a live Cleanverse call)",
      },
      ccp: {
        allowed: true,
        message: "DEMO_MOCK_CCP_PASS (not a live Cleanverse call)",
      },
      identityChecksHash,
    };
  }

  private async liveGate(
    address: string,
    role: string,
  ): Promise<ParticipantGate> {
    if (!this.cleanverse.isConfigured) {
      this.logger.warn(
        `Live trust mode but Cleanverse unconfigured — refusing ${role}`,
      );
      throw new BadRequestException({
        message:
          "Cleanverse not configured for live trust mode. Set CLEANVERSE_* or use LIEN_TRUST_MODE=demo on local.",
        code: "CLEANVERSE_NOT_CONFIGURED",
      });
    }

    const chain = this.cleanverseChain;
    const atoken = this.atokenAddress;
    if (!atoken) {
      throw new BadRequestException({
        message: "DEMO_ATOKEN_ADDRESS required for live CVI verify",
        code: "ATOKEN_MISSING",
      });
    }

    let queryStatus: number | undefined;
    let verifyCode: number | undefined;
    let cviEligible = false;
    let cviMessage = "CVI check failed";

    try {
      const query = await this.cleanverse.queryApass({ chain, address });
      queryStatus = Number(query.data?.status);
      const verify = await this.cleanverse.verifyApass({
        chain,
        atoken,
        address,
      });
      verifyCode = Number(verify.data?.code);
      cviEligible = queryStatus === 1 && verifyCode === 4;
      cviMessage = cviEligible
        ? "CVI A-Pass active and verified"
        : (verify.data?.message ?? "A-Pass not eligible");
    } catch (err) {
      this.logger.error(`CVI live gate error for ${address}`, err);
      cviMessage = err instanceof Error ? err.message : String(err);
      cviEligible = false;
    }

    let ccpAllowed = cviEligible;
    let ccpMessage = cviEligible
      ? "CCP: deferred to verified CVI (A-Pass)"
      : "CCP skipped — identity not eligible";

    /**
     * Optional Cleanverse validator (/validator/verify).
     * UAT often returns empty/partial payloads for general A-Token contexts.
     * Policy:
     * - CVI must pass (A-Pass active + verify code 4) — load-bearing
     * - explicit valid===false → block
     * - missing data / endpoint errors → soft-pass with note (unless LIEN_REQUIRE_CCP=true)
     */
    const requireCcp = Boolean(this.config.get<boolean>("lien.requireCcp"));

    if (cviEligible) {
      try {
        const compliance = await this.cleanverse.verifyUserCompliance({
          chain,
          contract_address: atoken,
          user_address: address,
        });
        const data = compliance?.data as
          | { valid?: boolean; message?: string }
          | null
          | undefined;

        if (data == null || typeof data !== "object") {
          ccpAllowed = !requireCcp;
          ccpMessage = requireCcp
            ? "Validator verify returned no data (LIEN_REQUIRE_CCP=true)"
            : "Validator verify returned no data — proceeding on verified CVI";
          this.logger.warn(
            `CCP empty payload for ${address}; requireCcp=${requireCcp}`,
          );
        } else if (data.valid === false) {
          ccpAllowed = false;
          ccpMessage =
            data.message ?? "CCP/compliance verify explicitly rejected";
        } else if (data.valid === true) {
          ccpAllowed = true;
          ccpMessage = "CCP/compliance verify accepted";
        } else {
          // valid undefined/null but envelope ok
          ccpAllowed = !requireCcp;
          ccpMessage = requireCcp
            ? "Validator response missing valid flag"
            : "Validator response incomplete — proceeding on verified CVI";
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`CCP verify error for ${address}: ${msg}`);
        if (requireCcp) {
          ccpAllowed = false;
          ccpMessage = msg;
        } else {
          // Soft-pass: A-Pass already verified; validator is optional in UAT.
          ccpAllowed = true;
          ccpMessage = `CCP validator unavailable (${msg}) — proceeding on verified CVI`;
        }
      }
    }

    const identityChecksHash = keccak256(
      stringToHex(
        `live|${chain}|${atoken}|${address.toLowerCase()}|${role}|cvi=${cviEligible}|ccp=${ccpAllowed}|qs=${queryStatus}|vc=${verifyCode}`,
      ),
    );

    return {
      address,
      role,
      source: "cleanverse-live",
      labeledMock: false,
      cvi: {
        eligible: cviEligible,
        queryStatus,
        verifyCode,
        message: cviMessage,
      },
      ccp: {
        allowed: ccpAllowed,
        message: ccpMessage,
      },
      identityChecksHash,
    };
  }
}
