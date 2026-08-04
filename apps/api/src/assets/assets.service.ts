import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createAssetFingerprint,
  isVerifyApassAllowed,
  mapVerifyApassMessage,
  type AssetStatus,
  type InvoiceFields,
} from '@repo/sdk';
import { AssetEntity } from './entities/asset.entity';
import { LienEntity } from './entities/lien.entity';
import { AuditEventEntity } from './entities/audit-event.entity';
import { CreateFingerprintDto } from './dto/create-fingerprint.dto';
import { CheckEncumbranceDto } from './dto/check-encumbrance.dto';
import { FinanceAssetDto } from './dto/finance-asset.dto';
import { CleanverseService } from '../cleanverse/cleanverse.service';
import {
  CleanverseApiError,
  CleanverseConfigError,
} from '../cleanverse/cleanverse.errors';
import type { PartyVerificationEvidence } from './party-verification.types';

type VerificationRole = PartyVerificationEvidence['role'];

type PartyVerificationInput = {
  role: VerificationRole;
  fingerprint: string;
  assetId: string | null;
  wallet?: string | null;
  chain?: string | null;
  atokenAddress?: string | null;
};

const verifyFailureCodes: Record<number, string> = {
  1: 'CVI_ATOKEN_NOT_FOUND',
  2: 'CVI_NO_APASS',
  3: 'CVI_TRANSFER_BLOCKED',
};

@Injectable()
export class AssetsService {
  private lastAuditTimestamp = 0;

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
    const issuerVerification = await this.verifyParty({
      role: 'issuer',
      fingerprint,
      assetId: asset?.id ?? null,
      wallet: dto.issuerWallet,
      chain: dto.chain,
      atokenAddress: dto.atokenAddress,
    });

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
        status: 'fingerprinted',
        chain: dto.chain,
        issuerWallet: dto.issuerWallet,
        debtorWallet: dto.debtorWallet ?? null,
        atokenAddress: dto.atokenAddress,
        issuerVerification,
        issuerCviVerifiedAt: new Date(issuerVerification.verifiedAt),
      });
    } else {
      asset.chain = dto.chain;
      asset.issuerWallet = dto.issuerWallet;
      asset.atokenAddress = dto.atokenAddress;
      asset.issuerVerification = issuerVerification;
      asset.issuerCviVerifiedAt = new Date(issuerVerification.verifiedAt);
      if (dto.debtorWallet) asset.debtorWallet = dto.debtorWallet;
    }

    const activeLien = await this.findActiveLien(fingerprint);
    asset.status = activeLien ? 'financed' : 'clean';
    asset = await this.assets.save(asset);

    if (isNew) {
      await this.audit('FINGERPRINT_CREATED', fingerprint, asset.id, {
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
      issuerVerification,
      createdAt: asset.createdAt,
    };
  }

  async check(dto: CheckEncumbranceDto) {
    const fingerprint = this.resolveFingerprint(dto);
    const asset = await this.assets.findOne({ where: { fingerprint } });
    const activeLien = await this.findActiveLien(fingerprint);

    const isClean = !activeLien;
    const status: AssetStatus = activeLien
      ? 'encumbered'
      : asset?.status === 'financed'
        ? 'financed'
        : asset
          ? 'clean'
          : 'draft';

    const result = {
      fingerprint,
      isClean,
      status,
      existingLienId: activeLien?.id ?? null,
      reason: activeLien
        ? `Asset already encumbered by first-priority lien ${activeLien.id} (lender ${activeLien.lenderCvi})`
        : asset
          ? 'No active lien — asset is clean for financing'
          : 'Fingerprint not registered yet; no active lien found',
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

    await this.audit('ENCUMBRANCE_CHECKED', fingerprint, asset?.id ?? null, {
      isClean,
      status,
      existingLienId: activeLien?.id ?? null,
    });

    return result;
  }

  async finance(dto: FinanceAssetDto) {
    if (!dto.fingerprint && !dto.fields) {
      throw new BadRequestException(
        'Provide fingerprint or invoice fields to finance an asset',
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
      throw new BadRequestException({
        message:
          'Fingerprint the invoice through the issuer verification gate before financing',
        code: 'FINGERPRINT_REQUIRED',
      });
    }

    const chain = dto.chain ?? asset.chain;
    const atokenAddress = dto.atokenAddress ?? asset.atokenAddress;
    const lenderVerification = await this.verifyParty({
      role: 'lender',
      fingerprint,
      assetId: asset.id,
      wallet: dto.lenderWallet,
      chain,
      atokenAddress,
    });

    const existing = await this.findActiveLien(fingerprint);
    if (existing) {
      await this.audit('FINANCING_BLOCKED', fingerprint, asset.id, {
        attemptedLenderCvi: dto.lenderCvi,
        attemptedLenderWallet: dto.lenderWallet,
        existingLienId: existing.id,
        existingLenderCvi: existing.lenderCvi,
        reason: 'duplicate_financing',
      });

      throw new ConflictException({
        message:
          'Financing blocked: underlying asset already has a first-priority lien',
        code: 'FINANCING_BLOCKED',
        fingerprint,
        existingLien: {
          id: existing.id,
          lenderCvi: existing.lenderCvi,
          priority: existing.priority,
          registeredAt: existing.registeredAt,
          cvaId: existing.cvaId,
        },
        lenderVerification,
      });
    }

    const lien = this.liens.create({
      fingerprint,
      assetId: asset.id,
      lenderCvi: dto.lenderCvi,
      lenderWallet: dto.lenderWallet,
      lenderVerification,
      lenderCviVerifiedAt: new Date(lenderVerification.verifiedAt),
      priority: 1,
      status: 'active',
      cvaId: dto.cvaId ?? asset.cvaId ?? null,
      txHash: dto.txHash ?? null,
    });

    const savedLien = await this.liens.save(lien);

    asset.status = 'financed';
    asset.chain = chain;
    asset.atokenAddress = atokenAddress;
    if (dto.cvaId) asset.cvaId = dto.cvaId;
    await this.assets.save(asset);

    await this.audit('LIEN_REGISTERED', fingerprint, asset.id, {
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
      lenderVerification,
      cleanverse: {
        allowed: true,
        verifyApass: {
          code: lenderVerification.verifyCode,
          message: lenderVerification.verifyMessage,
        },
      },
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
      order: { registeredAt: 'DESC' },
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
        order: { createdAt: 'DESC' },
        take,
      });
    }
    return this.audits.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async listAssets(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const assets = await this.assets.find({
      order: { createdAt: 'DESC' },
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

  async exportAudit(
    fingerprint?: string,
    format: 'csv' | 'json' = 'csv',
    limit = 200,
  ) {
    const events = await this.listAudit(fingerprint, limit);
    if (format === 'json') {
      return {
        exportedAt: new Date().toISOString(),
        fingerprint: fingerprint?.toLowerCase() ?? null,
        count: events.length,
        events,
      };
    }

    const headings = [
      'eventId',
      'type',
      'fingerprint',
      'assetId',
      'createdAt',
      'payload',
    ];
    const rows = events.map((event) =>
      [
        event.id,
        event.type,
        event.fingerprint ?? '',
        event.assetId ?? '',
        new Date(event.createdAt).toISOString(),
        JSON.stringify(event.payload),
      ]
        .map((value) => this.escapeCsv(value))
        .join(','),
    );
    return [headings.join(','), ...rows].join('\n');
  }

  private resolveFingerprint(dto: CheckEncumbranceDto): string {
    if (dto.fingerprint) return dto.fingerprint.toLowerCase();
    if (dto.fields) {
      return createAssetFingerprint(this.toInvoiceFields(dto.fields));
    }
    throw new BadRequestException('Provide fingerprint or invoice fields');
  }

  private toInvoiceFields(
    input: InvoiceFields | CreateFingerprintDto | CheckEncumbranceDto['fields'],
  ): InvoiceFields {
    if (!input) {
      throw new BadRequestException('Invoice fields are required');
    }
    return {
      issuerCvi: input.issuerCvi,
      debtorCvi: input.debtorCvi,
      documentHash: input.documentHash,
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      currency: (input.currency ?? 'USD').toUpperCase(),
      dueDate: input.dueDate,
    };
  }

  private async findActiveLien(fingerprint: string) {
    return this.liens.findOne({
      where: {
        fingerprint: fingerprint.toLowerCase(),
        status: 'active',
        priority: 1,
      },
    });
  }

  private async verifyParty({
    role,
    fingerprint,
    assetId,
    wallet,
    chain,
    atokenAddress,
  }: PartyVerificationInput): Promise<PartyVerificationEvidence> {
    const missing = [
      !wallet && 'wallet',
      !chain && 'chain',
      !atokenAddress && 'atokenAddress',
    ].filter((value): value is string => Boolean(value));

    if (missing.length > 0) {
      await this.rejectParty({
        role,
        fingerprint,
        assetId,
        wallet,
        chain,
        atokenAddress,
        code: 'CVI_INPUT_REQUIRED',
        message: `${this.titleCase(role)} verification requires ${missing.join(', ')}`,
        kind: 'input',
      });
    }

    try {
      const query = await this.cleanverse.queryApass({
        chain: chain!,
        address: wallet!,
      });
      const pass = query.data;
      const status = Number(pass?.status);
      const expirationTime =
        typeof pass?.expirationTime === 'number' ? pass.expirationTime : null;

      if (!pass || !Number.isFinite(status)) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_NO_APASS',
          message: `${this.titleCase(role)} wallet has no queryable A-Pass`,
          kind: 'forbidden',
        });
      }

      if (expirationTime === null || !Number.isFinite(expirationTime)) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_QUERY_MALFORMED',
          message: 'Cleanverse A-Pass response omitted a valid expiration time',
          kind: 'upstream',
        });
      }
      const verifiedExpirationTime = expirationTime as number;

      if (status === 2) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_FROZEN',
          message: `${this.titleCase(role)} A-Pass is frozen`,
          kind: 'forbidden',
        });
      }

      if (status !== 1) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_STATUS_INVALID',
          message: `${this.titleCase(role)} A-Pass is not active`,
          kind: 'forbidden',
        });
      }

      if (verifiedExpirationTime <= Math.floor(Date.now() / 1000)) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_EXPIRED',
          message: `${this.titleCase(role)} A-Pass has expired`,
          kind: 'forbidden',
        });
      }

      const verification = await this.cleanverse.verifyApass({
        chain: chain!,
        atoken: atokenAddress!,
        address: wallet!,
      });
      const verifyCode = Number(verification.data?.code);

      if (!Number.isFinite(verifyCode) || !isVerifyApassAllowed(verifyCode)) {
        const code = Number.isFinite(verifyCode)
          ? (verifyFailureCodes[verifyCode] ?? 'CVI_VERIFY_FAILED')
          : 'CVI_VERIFY_MALFORMED';
        const message = Number.isFinite(verifyCode)
          ? mapVerifyApassMessage(verifyCode)
          : 'Cleanverse returned a malformed verify_apass response';
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code,
          message: `${this.titleCase(role)} verification failed: ${message}`,
          kind: 'forbidden',
          cleanverseCode: Number.isFinite(verifyCode) ? verifyCode : null,
        });
      }

      const verifiedAt = new Date().toISOString();
      const evidence: PartyVerificationEvidence = {
        role,
        wallet: wallet!,
        chain: chain!,
        atokenAddress: atokenAddress!,
        cvRecordId: pass.cvRecordId ?? null,
        tier: pass.tier ?? null,
        subTier: pass.subTier ?? null,
        group: pass.group ?? null,
        status,
        expirationTime: verifiedExpirationTime,
        verifyCode,
        verifyMessage: mapVerifyApassMessage(verifyCode),
        verifiedAt,
      };

      await this.audit('CVI_VERIFIED', fingerprint, assetId, {
        ...evidence,
        atoken: evidence.atokenAddress,
      });
      return evidence;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      if (error instanceof CleanverseConfigError) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_GATE_UNAVAILABLE',
          message: 'Cleanverse verification is not configured on the API',
          kind: 'unavailable',
        });
      }
      if (error instanceof CleanverseApiError) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_UPSTREAM_ERROR',
          message: `Cleanverse verification unavailable: ${error.message}`,
          kind: 'upstream',
          cleanverseCode: error.code,
        });
      }
      throw error;
    }
  }

  private async rejectParty(
    input: PartyVerificationInput & {
      code: string;
      message: string;
      kind: 'input' | 'forbidden' | 'unavailable' | 'upstream';
      cleanverseCode?: string | number | null;
    },
  ): Promise<never> {
    await this.audit(
      'CVI_VERIFICATION_FAILED',
      input.fingerprint,
      input.assetId,
      {
        role: input.role,
        wallet: input.wallet ?? null,
        chain: input.chain ?? null,
        atoken: input.atokenAddress ?? null,
        code: input.code,
        cleanverseCode: input.cleanverseCode ?? null,
      },
    );

    const body = {
      message: input.message,
      code: input.code,
      role: input.role,
    };
    if (input.kind === 'input') throw new BadRequestException(body);
    if (input.kind === 'unavailable') {
      throw new ServiceUnavailableException(body);
    }
    if (input.kind === 'upstream') throw new BadGatewayException(body);
    throw new ForbiddenException(body);
  }

  private titleCase(value: string) {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  private escapeCsv(value: string | number | boolean | null | undefined) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private async audit(
    type: AuditEventEntity['type'],
    fingerprint: string | null,
    assetId: string | null,
    payload: Record<string, unknown>,
  ) {
    const now = Date.now();
    this.lastAuditTimestamp = Math.max(now, this.lastAuditTimestamp + 1);
    const event = this.audits.create({
      type,
      fingerprint: fingerprint?.toLowerCase() ?? null,
      assetId,
      payload,
      createdAt: new Date(this.lastAuditTimestamp),
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
      issuerVerification: asset.issuerVerification,
      issuerCviVerifiedAt: asset.issuerCviVerifiedAt,
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
      lenderVerification: lien.lenderVerification,
      lenderCviVerifiedAt: lien.lenderCviVerifiedAt,
      priority: lien.priority,
      status: lien.status,
      cvaId: lien.cvaId,
      txHash: lien.txHash,
      registeredAt: lien.registeredAt,
    };
  }
}
