import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  createAssetFingerprint,
  isVerifyApassAllowed,
  mapVerifyApassMessage,
  type AssetStatus,
  type InvoiceFields,
} from "@repo/sdk";
import { AssetEntity } from "./entities/asset.entity";
import { LienEntity } from "./entities/lien.entity";
import { AuditEventEntity } from "./entities/audit-event.entity";
import { CreateFingerprintDto } from "./dto/create-fingerprint.dto";
import { CheckEncumbranceDto } from "./dto/check-encumbrance.dto";
import { FinanceAssetDto } from "./dto/finance-asset.dto";
import { CleanverseService } from "../cleanverse/cleanverse.service";
import { CleanverseApiError } from "../cleanverse/cleanverse.errors";

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AssetEntity)
    private readonly assets: Repository<AssetEntity>,
    @InjectRepository(LienEntity)
    private readonly liens: Repository<LienEntity>,
    @InjectRepository(AuditEventEntity)
    private readonly audits: Repository<AuditEventEntity>,
    private readonly cleanverse: CleanverseService,
  ) {}

  async createFingerprint(dto: CreateFingerprintDto) {
    const fields = this.toInvoiceFields(dto);
    const fingerprint = createAssetFingerprint(fields);

    let asset = await this.assets.findOne({ where: { fingerprint } });
    const isNew = !asset;

    if (!asset) {
      asset = this.assets.create({
        fingerprint,
        issuerCvi: fields.issuerCvi,
        debtorCvi: fields.debtorCvi,
        documentHash: fields.documentHash,
        invoiceNumber: fields.invoiceNumber,
        amount: fields.amount,
        currency: fields.currency,
        dueDate: fields.dueDate,
        status: "fingerprinted",
        chain: dto.chain ?? null,
        issuerWallet: dto.issuerWallet ?? null,
        debtorWallet: dto.debtorWallet ?? null,
      });
    } else {
      if (dto.chain) asset.chain = dto.chain;
      if (dto.issuerWallet) asset.issuerWallet = dto.issuerWallet;
      if (dto.debtorWallet) asset.debtorWallet = dto.debtorWallet;
    }

    const activeLien = await this.findActiveLien(fingerprint);
    asset.status = activeLien ? "financed" : "clean";
    asset = await this.assets.save(asset);

    if (isNew) {
      await this.audit("FINGERPRINT_CREATED", fingerprint, asset.id, {
        invoiceNumber: fields.invoiceNumber,
        amount: fields.amount,
        currency: fields.currency,
      });
    }

    return {
      id: asset.id,
      fingerprint: asset.fingerprint,
      status: asset.status,
      fields: this.assetFields(asset),
      isClean: !activeLien,
      existingLienId: activeLien?.id ?? null,
      createdAt: asset.createdAt,
    };
  }

  async check(dto: CheckEncumbranceDto) {
    const fingerprint = await this.resolveFingerprint(dto);
    const asset = await this.assets.findOne({ where: { fingerprint } });
    const activeLien = await this.findActiveLien(fingerprint);

    const isClean = !activeLien;
    const status: AssetStatus = activeLien
      ? "encumbered"
      : asset?.status === "financed"
        ? "financed"
        : asset
          ? "clean"
          : "draft";

    const result = {
      fingerprint,
      isClean,
      status,
      existingLienId: activeLien?.id ?? null,
      reason: activeLien
        ? `Asset already encumbered by first-priority lien ${activeLien.id} (lender ${activeLien.lenderCvi})`
        : asset
          ? "No active lien — asset is clean for financing"
          : "Fingerprint not registered yet; no active lien found",
      asset: asset
        ? {
            id: asset.id,
            status: asset.status,
            invoiceNumber: asset.invoiceNumber,
          }
        : null,
      lien: activeLien
        ? {
            id: activeLien.id,
            lenderCvi: activeLien.lenderCvi,
            priority: activeLien.priority,
            registeredAt: activeLien.registeredAt,
          }
        : null,
    };

    await this.audit(
      "ENCUMBRANCE_CHECKED",
      fingerprint,
      asset?.id ?? null,
      {
        isClean,
        status,
        existingLienId: activeLien?.id ?? null,
      },
    );

    return result;
  }

  async finance(dto: FinanceAssetDto) {
    if (!dto.fingerprint && !dto.fields) {
      throw new BadRequestException(
        "Provide fingerprint or invoice fields to finance an asset",
      );
    }

    let asset: AssetEntity | null = null;
    let fingerprint: string;

    if (dto.fingerprint) {
      fingerprint = dto.fingerprint.toLowerCase();
      asset = await this.assets.findOne({ where: { fingerprint } });
      if (!asset) {
        throw new NotFoundException(
          `No asset registered for fingerprint ${fingerprint}. Create a fingerprint first.`,
        );
      }
    } else {
      const created = await this.createFingerprint({
        ...dto.fields!,
        currency: dto.fields!.currency ?? "USD",
        chain: dto.chain,
      });
      fingerprint = created.fingerprint;
      asset = await this.assets.findOneOrFail({ where: { fingerprint } });
    }

    const existing = await this.findActiveLien(fingerprint);
    if (existing) {
      await this.audit("FINANCING_BLOCKED", fingerprint, asset.id, {
        attemptedLenderCvi: dto.lenderCvi,
        existingLienId: existing.id,
        existingLenderCvi: existing.lenderCvi,
        reason: "duplicate_financing",
      });

      throw new ConflictException({
        message:
          "Financing blocked: underlying asset already has a first-priority lien",
        code: "FINANCING_BLOCKED",
        fingerprint,
        existingLien: {
          id: existing.id,
          lenderCvi: existing.lenderCvi,
          priority: existing.priority,
          registeredAt: existing.registeredAt,
          cvaId: existing.cvaId,
        },
      });
    }

    const chain = dto.chain ?? asset.chain ?? "base";
    let cleanverse: Record<string, unknown> | null = null;

    const shouldVerify =
      (dto.requireCleanverseVerify ?? true) &&
      Boolean(dto.lenderWallet && dto.atokenAddress);

    if (shouldVerify) {
      try {
        const verification = await this.cleanverse.verifyApass({
          chain,
          atoken: dto.atokenAddress!,
          address: dto.lenderWallet!,
        });
        const code = verification.data?.code;
        cleanverse = {
          verifyApass: verification.data,
          allowed: typeof code === "number" ? isVerifyApassAllowed(code) : false,
        };

        await this.audit("CVI_VERIFIED", fingerprint, asset.id, {
          role: "lender",
          wallet: dto.lenderWallet,
          atoken: dto.atokenAddress,
          code,
          message:
            typeof code === "number" ? mapVerifyApassMessage(code) : undefined,
        });

        if (typeof code === "number" && !isVerifyApassAllowed(code)) {
          throw new BadRequestException({
            message: `Lender Cleanverse verification failed: ${mapVerifyApassMessage(code)}`,
            code: "CVI_VERIFY_FAILED",
            cleanverse: verification.data,
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        if (error instanceof CleanverseApiError) {
          throw new BadRequestException({
            message: `Cleanverse verify failed: ${error.message}`,
            code: error.code,
            cleanverse: error.raw,
          });
        }
        throw error;
      }
    }

    const lien = this.liens.create({
      fingerprint,
      assetId: asset.id,
      lenderCvi: dto.lenderCvi,
      lenderWallet: dto.lenderWallet ?? null,
      priority: 1,
      status: "active",
      cvaId: dto.cvaId ?? asset.cvaId ?? null,
      txHash: dto.txHash ?? null,
    });

    const savedLien = await this.liens.save(lien);

    asset.status = "financed";
    if (dto.chain) asset.chain = dto.chain;
    if (dto.atokenAddress) asset.atokenAddress = dto.atokenAddress;
    if (dto.cvaId) asset.cvaId = dto.cvaId;
    await this.assets.save(asset);

    await this.audit("LIEN_REGISTERED", fingerprint, asset.id, {
      lienId: savedLien.id,
      lenderCvi: savedLien.lenderCvi,
      priority: savedLien.priority,
      cvaId: savedLien.cvaId,
      txHash: savedLien.txHash,
    });

    return {
      success: true,
      fingerprint,
      asset: {
        id: asset.id,
        status: asset.status,
        invoiceNumber: asset.invoiceNumber,
        amount: asset.amount,
        currency: asset.currency,
      },
      lien: {
        id: savedLien.id,
        lenderCvi: savedLien.lenderCvi,
        lenderWallet: savedLien.lenderWallet,
        priority: savedLien.priority,
        status: savedLien.status,
        cvaId: savedLien.cvaId,
        txHash: savedLien.txHash,
        registeredAt: savedLien.registeredAt,
      },
      cleanverse,
    };
  }

  async getByFingerprint(fingerprint: string) {
    const normalized = fingerprint.toLowerCase();
    const asset = await this.assets.findOne({
      where: { fingerprint: normalized },
    });
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${normalized}`);
    }

    const liens = await this.liens.find({
      where: { fingerprint: normalized },
      order: { registeredAt: "DESC" },
    });

    return {
      ...this.serializeAsset(asset),
      liens: liens.map((l) => this.serializeLien(l)),
    };
  }

  async listAudit(fingerprint?: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    if (fingerprint) {
      return this.audits.find({
        where: { fingerprint: fingerprint.toLowerCase() },
        order: { createdAt: "DESC" },
        take,
      });
    }
    return this.audits.find({
      order: { createdAt: "DESC" },
      take,
    });
  }

  async listAssets(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const assets = await this.assets.find({
      order: { createdAt: "DESC" },
      take,
    });
    return Promise.all(
      assets.map(async (asset) => {
        const activeLien = await this.findActiveLien(asset.fingerprint);
        return {
          ...this.serializeAsset(asset),
          isClean: !activeLien,
          activeLienId: activeLien?.id ?? null,
        };
      }),
    );
  }

  private async resolveFingerprint(dto: CheckEncumbranceDto): Promise<string> {
    if (dto.fingerprint) return dto.fingerprint.toLowerCase();
    if (dto.fields) {
      return createAssetFingerprint(this.toInvoiceFields(dto.fields));
    }
    throw new BadRequestException("Provide fingerprint or invoice fields");
  }

  private toInvoiceFields(
    input: InvoiceFields | CreateFingerprintDto | CheckEncumbranceDto["fields"],
  ): InvoiceFields {
    if (!input) {
      throw new BadRequestException("Invoice fields are required");
    }
    return {
      issuerCvi: input.issuerCvi,
      debtorCvi: input.debtorCvi,
      documentHash: input.documentHash,
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      currency: (input.currency ?? "USD").toUpperCase(),
      dueDate: input.dueDate,
    };
  }

  private async findActiveLien(fingerprint: string) {
    return this.liens.findOne({
      where: {
        fingerprint: fingerprint.toLowerCase(),
        status: "active",
        priority: 1,
      },
    });
  }

  private async audit(
    type: AuditEventEntity["type"],
    fingerprint: string | null,
    assetId: string | null,
    payload: Record<string, unknown>,
  ) {
    const event = this.audits.create({
      type,
      fingerprint: fingerprint?.toLowerCase() ?? null,
      assetId,
      payload,
    });
    await this.audits.save(event);
  }

  private assetFields(asset: AssetEntity): InvoiceFields {
    return {
      issuerCvi: asset.issuerCvi,
      debtorCvi: asset.debtorCvi,
      documentHash: asset.documentHash,
      invoiceNumber: asset.invoiceNumber,
      amount: asset.amount,
      currency: asset.currency,
      dueDate: asset.dueDate,
    };
  }

  private serializeAsset(asset: AssetEntity) {
    return {
      id: asset.id,
      fingerprint: asset.fingerprint,
      status: asset.status,
      fields: this.assetFields(asset),
      chain: asset.chain,
      issuerWallet: asset.issuerWallet,
      debtorWallet: asset.debtorWallet,
      atokenAddress: asset.atokenAddress,
      cvaId: asset.cvaId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private serializeLien(lien: LienEntity) {
    return {
      id: lien.id,
      fingerprint: lien.fingerprint,
      lenderCvi: lien.lenderCvi,
      lenderWallet: lien.lenderWallet,
      priority: lien.priority,
      status: lien.status,
      cvaId: lien.cvaId,
      txHash: lien.txHash,
      registeredAt: lien.registeredAt,
    };
  }
}
