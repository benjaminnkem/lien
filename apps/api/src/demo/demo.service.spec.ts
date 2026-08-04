import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AssetsService } from '../assets/assets.service';
import { DemoService } from './demo.service';

const configuredValues: Record<string, string> = {
  'demo.chain': 'base',
  'demo.atokenAddress': '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'demo.issuerCvi': 'cvi:issuer:demo',
  'demo.issuerWallet': '0x1111111111111111111111111111111111111111',
  'demo.debtorCvi': 'cvi:debtor:demo',
  'demo.lenderACvi': 'cvi:lender:a',
  'demo.lenderAWallet': '0x2222222222222222222222222222222222222222',
  'demo.lenderBCvi': 'cvi:lender:b',
  'demo.lenderBWallet': '0x3333333333333333333333333333333333333333',
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

  it('seeds verified parties and captures the expected conflict', async () => {
    const { service, assets } = await createService();
    const result = await service.seed({ includeConflict: true });

    expect(result.conflict).toMatchObject({
      attempted: true,
      blocked: true,
      code: 'FINANCING_BLOCKED',
    });
    expect(result.auditCount).toBe(7);
    expect(assets.finance).toHaveBeenCalledTimes(2);
  });

  it('fails before mutation when sandbox wallets are missing', async () => {
    const { service, assets } = await createService({
      ...configuredValues,
      'demo.lenderBWallet': '',
    });

    await expect(service.seed({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(assets.createFingerprint).not.toHaveBeenCalled();
  });
});
