import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { AssetsService } from '../assets/assets.service';
import { SeedDemoDto } from './dto/seed-demo.dto';

type DemoParty = {
  label: string;
  cvi: string;
};

type DemoConfig = {
  chain: string;
  conflictChain: string;
  atokenAddress: string;
  issuer: DemoParty;
  lenderA: DemoParty;
  lenderB: DemoParty;
  debtorCvi: string;
};

@Injectable()
export class DemoService {
  constructor(
    private readonly config: ConfigService,
    private readonly assets: AssetsService,
  ) {}

  getPublicConfig() {
    const demo = this.readConfig();
    const missing = [
      !demo.atokenAddress && 'DEMO_ATOKEN_ADDRESS',
    ].filter((value): value is string => Boolean(value));

    return {
      ready: missing.length === 0,
      missing,
      chain: demo.chain,
      conflictChain: demo.conflictChain,
      atokenAddress: demo.atokenAddress || null,
      parties: {
        issuer: this.publicParty(demo.issuer),
        lenderA: this.publicParty(demo.lenderA),
        lenderB: this.publicParty(demo.lenderB),
      },
      debtorCvi: demo.debtorCvi,
      scope: 'global',
      walletSource: 'browser',
    };
  }

  async seed(dto: SeedDemoDto) {
    const publicConfig = this.getPublicConfig();
    if (!publicConfig.ready || !publicConfig.atokenAddress) {
      throw new ServiceUnavailableException({
        message:
          'Demo A-Token is not configured. Set DEMO_ATOKEN_ADDRESS for Cleanverse verify_apass.',
        code: 'DEMO_CONFIG_MISSING',
        missing: publicConfig.missing,
      });
    }

    const demo = this.readConfig();
    const issuerWallet = dto.issuerWallet.trim();
    const lenderAWallet = dto.lenderAWallet.trim();
    const lenderBWallet = dto.lenderBWallet.trim();
    const issuerCvi = dto.issuerCvi?.trim() || demo.issuer.cvi;
    const debtorCvi = dto.debtorCvi?.trim() || demo.debtorCvi;
    const lenderACvi = dto.lenderACvi?.trim() || demo.lenderA.cvi;
    const lenderBCvi = dto.lenderBCvi?.trim() || demo.lenderB.cvi;

    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const invoiceNumber = `INV-2026-${suffix}`;
    const documentHash = `0x${createHash('sha256')
      .update(`lien-demo:${invoiceNumber}`)
      .digest('hex')}`;
    const dueDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const fingerprint = await this.assets.createFingerprint({
      issuerCvi,
      debtorCvi,
      documentHash,
      invoiceNumber,
      amount: '128500.00',
      currency: 'USD',
      dueDate,
      chain: demo.chain,
      issuerWallet,
      atokenAddress: demo.atokenAddress,
    });
    const registry = await this.assets.check({
      fingerprint: fingerprint.fingerprint,
    });
    const cva = await this.assets.issueCva({
      fingerprint: fingerprint.fingerprint,
      adminAddress: issuerWallet,
    });
    const firstFinance = await this.assets.finance({
      fingerprint: fingerprint.fingerprint,
      lenderCvi: lenderACvi,
      lenderWallet: lenderAWallet,
      chain: demo.chain,
      atokenAddress:
        cva.cva.atokenAddress ?? demo.atokenAddress,
    });

    let conflict: {
      attempted: boolean;
      blocked: boolean;
      code: string | null;
      message: string | null;
      attemptedChain: string | null;
      settlementChain: string | null;
      crossChain: boolean;
      reason: string | null;
    } = {
      attempted: false,
      blocked: false,
      code: null,
      message: null,
      attemptedChain: null,
      settlementChain: null,
      crossChain: false,
      reason: null,
    };

    if (dto.includeConflict ?? true) {
      try {
        await this.assets.finance({
          fingerprint: fingerprint.fingerprint,
          lenderCvi: lenderBCvi,
          lenderWallet: lenderBWallet,
          chain: demo.conflictChain,
          atokenAddress: demo.atokenAddress,
        });
        conflict = {
          attempted: true,
          blocked: false,
          code: null,
          message: 'Unexpectedly financed a second time',
          attemptedChain: demo.conflictChain,
          settlementChain: demo.chain,
          crossChain: demo.conflictChain !== demo.chain,
          reason: null,
        };
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        const response = error.getResponse();
        const payload =
          typeof response === 'object' && response !== null
            ? (response as Record<string, unknown>)
            : {};
        conflict = {
          attempted: true,
          blocked: payload.code === 'FINANCING_BLOCKED',
          code: typeof payload.code === 'string' ? payload.code : null,
          message: typeof payload.message === 'string' ? payload.message : null,
          attemptedChain:
            typeof payload.attemptedChain === 'string'
              ? payload.attemptedChain
              : demo.conflictChain,
          settlementChain:
            typeof payload.settlementChain === 'string'
              ? payload.settlementChain
              : demo.chain,
          crossChain: payload.crossChain === true,
          reason: typeof payload.reason === 'string' ? payload.reason : null,
        };
      }
    }

    const audit = await this.assets.listAudit(fingerprint.fingerprint, 200);
    return {
      seededAt: new Date().toISOString(),
      config: {
        ...publicConfig,
        parties: {
          issuer: { ...publicConfig.parties.issuer, wallet: issuerWallet },
          lenderA: { ...publicConfig.parties.lenderA, wallet: lenderAWallet },
          lenderB: { ...publicConfig.parties.lenderB, wallet: lenderBWallet },
        },
      },
      invoice: fingerprint.fields,
      fingerprint,
      registry,
      firstFinance,
      conflict,
      auditCount: audit.length,
    };
  }

  private readConfig(): DemoConfig {
    return {
      chain: this.config.get<string>('demo.chain') ?? 'ethereum',
      conflictChain: this.config.get<string>('demo.conflictChain') ?? 'base',
      atokenAddress: this.config.get<string>('demo.atokenAddress') ?? '',
      issuer: {
        label: 'Atlas Manufacturing',
        cvi:
          this.config.get<string>('demo.issuerCvi') ??
          'cvi:issuer:atlas-manufacturing',
      },
      lenderA: {
        label: 'Northstar Capital',
        cvi:
          this.config.get<string>('demo.lenderACvi') ??
          'cvi:lender:northstar-capital',
      },
      lenderB: {
        label: 'Meridian Credit',
        cvi:
          this.config.get<string>('demo.lenderBCvi') ??
          'cvi:lender:meridian-credit',
      },
      debtorCvi:
        this.config.get<string>('demo.debtorCvi') ??
        'cvi:debtor:northline-retail',
    };
  }

  private publicParty(party: DemoParty) {
    return {
      label: party.label,
      cvi: party.cvi,
      wallet: null as string | null,
    };
  }
}
