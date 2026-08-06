import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AssetsService } from '../assets/assets.service';
import { DemoService } from './demo.service';

const configuredValues: Record<string, string> = {
  'demo.chain': 'ethereum',
  'demo.conflictChain': 'base',
  'demo.atokenAddress': '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'demo.issuerCvi': 'cvi:issuer:demo',
  'demo.debtorCvi': 'cvi:debtor:demo',
  'demo.lenderACvi': 'cvi:lender:a',
  'demo.lenderBCvi': 'cvi:lender:b',
};

const seedWallets = {
  issuerWallet: '0x1111111111111111111111111111111111111111',
  lenderAWallet: '0x2222222222222222222222222222222222222222',
  lenderBWallet: '0x3333333333333333333333333333333333333333',
};

describe('DemoService', () => {
  function createService(values: Record<string, string> = configuredValues) {
    const assets = {
      createFingerprint: jest.fn().mockResolvedValue({
        id: 'asset-1',
        fingerprint: `0x${'a'.repeat(64)}`,
        fields: { invoiceNumber: 'INV-DEMO' },
      }),
      check: jest.fn().mockResolvedValue({ isClean: true }),
      finance: jest
        .fn()
        .mockResolvedValueOnce({ lien: { id: 'lien-1' } })
        .mockRejectedValueOnce(
          new ConflictException({
            code: 'FINANCING_BLOCKED',
            message: 'Already financed',
            crossChain: true,
            attemptedChain: 'base',
            settlementChain: 'ethereum',
            reason: 'CROSS_CHAIN_REPLEDGE',
          }),
        ),
      listAudit: jest.fn().mockResolvedValue(new Array(7).fill({})),
    };

    return Test.createTestingModule({
      providers: [
        DemoService,
        { provide: AssetsService, useValue: assets },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => values[key]) },
        },
      ],
    })
      .compile()
      .then((module) => ({ service: module.get(DemoService), assets }));
  }

  it('seeds with browser-supplied wallets and captures conflict', async () => {
    const { service, assets } = await createService();
    const result = await service.seed({
      includeConflict: true,
      ...seedWallets,
    });

    expect(result.conflict).toMatchObject({
      attempted: true,
      blocked: true,
      code: 'FINANCING_BLOCKED',
    });
    expect(result.auditCount).toBe(7);
    expect(assets.createFingerprint).toHaveBeenCalledWith(
      expect.objectContaining({ issuerWallet: seedWallets.issuerWallet }),
    );
    expect(assets.finance).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ lenderWallet: seedWallets.lenderAWallet }),
    );
    expect(assets.finance).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        lenderWallet: seedWallets.lenderBWallet,
        chain: 'base',
      }),
    );
  });

  it('fails when A-Token is missing', async () => {
    const { service, assets } = await createService({
      ...configuredValues,
      'demo.atokenAddress': '',
    });

    await expect(service.seed(seedWallets)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(assets.createFingerprint).not.toHaveBeenCalled();
  });

  it('exposes public config without server-side wallets', async () => {
    const { service } = await createService();
    const config = service.getPublicConfig();
    expect(config.ready).toBe(true);
    expect(config.walletSource).toBe('browser');
    expect(config.parties.issuer.wallet).toBeNull();
    expect(config.parties.lenderA.wallet).toBeNull();
  });
});
