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
  wallet: string;
};

type DemoConfig = {
  chain: string;
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
      !demo.issuer.wallet && 'DEMO_ISSUER_WALLET',
      !demo.lenderA.wallet && 'DEMO_LENDER_A_WALLET',
      !demo.lenderB.wallet && 'DEMO_LENDER_B_WALLET',
    ].filter((value): value is string => Boolean(value));

    return {
      ready: missing.length === 0,
      missing,
      chain: demo.chain,
      atokenAddress: demo.atokenAddress || null,
      parties: {
        issuer: this.publicParty(demo.issuer),
        lenderA: this.publicParty(demo.lenderA),
        lenderB: this.publicParty(demo.lenderB),
      },
      debtorCvi: demo.debtorCvi,
    };
  }

  async seed(dto: SeedDemoDto) {
    const publicConfig = this.getPublicConfig();
    if (!publicConfig.ready) {
      throw new ServiceUnavailableException({
        message:
          'Demo sandbox identities are not configured. Add Cleanverse-issued wallets and an A-Token to the API environment.',
        code: 'DEMO_CONFIG_MISSING',
        missing: publicConfig.missing,
      });
    }

    const demo = this.readConfig();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const invoiceNumber = `INV-2026-${suffix}`;
    const documentHash = `0x${createHash('sha256')
      .update(`lien-demo:${invoiceNumber}`)
      .digest('hex')}`;
    const dueDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const fingerprint = await this.assets.createFingerprint({
      issuerCvi: demo.issuer.cvi,
      debtorCvi: demo.debtorCvi,
      documentHash,
      invoiceNumber,
      amount: '128500.00',
      currency: 'USD',
      dueDate,
      chain: demo.chain,
      issuerWallet: demo.issuer.wallet,
      atokenAddress: demo.atokenAddress,
    });
    const registry = await this.assets.check({
      fingerprint: fingerprint.fingerprint,
    });
    const firstFinance = await this.assets.finance({
      fingerprint: fingerprint.fingerprint,
      lenderCvi: demo.lenderA.cvi,
      lenderWallet: demo.lenderA.wallet,
      chain: demo.chain,
      atokenAddress: demo.atokenAddress,
    });

    let conflict: {
      attempted: boolean;
      blocked: boolean;
      code: string | null;
      message: string | null;
    } = {
      attempted: false,
      blocked: false,
      code: null,
      message: null,
    };

    if (dto.includeConflict ?? true) {
      try {
        await this.assets.finance({
          fingerprint: fingerprint.fingerprint,
          lenderCvi: demo.lenderB.cvi,
          lenderWallet: demo.lenderB.wallet,
          chain: demo.chain,
          atokenAddress: demo.atokenAddress,
        });
        conflict = {
          attempted: true,
          blocked: false,
          code: null,
          message: 'Unexpectedly financed a second time',
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
        };
      }
    }

    const audit = await this.assets.listAudit(fingerprint.fingerprint, 200);
    return {
      seededAt: new Date().toISOString(),
      config: publicConfig,
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
      atokenAddress: this.config.get<string>('demo.atokenAddress') ?? '',
      issuer: {
        label: 'Atlas Manufacturing',
        cvi:
          this.config.get<string>('demo.issuerCvi') ??
          'cvi:issuer:atlas-manufacturing',
        wallet: this.config.get<string>('demo.issuerWallet') ?? '',
      },
      lenderA: {
        label: 'Northstar Capital',
        cvi:
          this.config.get<string>('demo.lenderACvi') ??
          'cvi:lender:northstar-capital',
        wallet: this.config.get<string>('demo.lenderAWallet') ?? '',
      },
      lenderB: {
        label: 'Meridian Credit',
        cvi:
          this.config.get<string>('demo.lenderBCvi') ??
          'cvi:lender:meridian-credit',
        wallet: this.config.get<string>('demo.lenderBWallet') ?? '',
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
      wallet: party.wallet || null,
    };
  }
}
