import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createAssetFingerprint } from '@repo/sdk';
import { AssetsService } from './assets.service';
import { AssetEntity } from './entities/asset.entity';
import { LienEntity } from './entities/lien.entity';
import { AuditEventEntity } from './entities/audit-event.entity';
import { CleanverseService } from '../cleanverse/cleanverse.service';

type Store<T extends { id: string }> = Map<string, T>;

function memoryRepo<T extends { id: string }>(store: Store<T>) {
  return {
    create: (data: Partial<T>) =>
      ({
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        registeredAt: new Date(),
        ...data,
      }) as unknown as T,
    save: (entity: T) => {
      store.set(entity.id, entity);
      return Promise.resolve(entity);
    },
    findOne: (opts: { where: Partial<T> & Record<string, unknown> }) => {
      const where = opts.where;
      for (const item of store.values()) {
        const match = Object.entries(where).every(
          ([k, v]) => (item as Record<string, unknown>)[k] === v,
        );
        if (match) return Promise.resolve(item);
      }
      return Promise.resolve(null);
    },
    findOneOrFail: async (opts: {
      where: Partial<T> & Record<string, unknown>;
    }) => {
      const found = await memoryRepo(store).findOne(opts);
      if (!found) throw new Error('not found');
      return found;
    },
    find: (opts?: {
      where?: Partial<T> & Record<string, unknown>;
      order?: Record<string, 'ASC' | 'DESC'>;
      take?: number;
    }) => {
      let items = [...store.values()];
      if (opts?.where) {
        items = items.filter((item) =>
          Object.entries(opts.where!).every(
            ([k, v]) => (item as Record<string, unknown>)[k] === v,
          ),
        );
      }
      if (opts?.take) items = items.slice(0, opts.take);
      return Promise.resolve(items);
    },
  };
}

const invoice = {
  issuerCvi: 'cvi:issuer:acme',
  debtorCvi: 'cvi:debtor:buyer',
  documentHash:
    '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  invoiceNumber: 'INV-TEST-1',
  amount: '50000.00',
  currency: 'USD',
  dueDate: '2026-12-31',
  chain: 'base',
  issuerWallet: '0x1111111111111111111111111111111111111111',
  atokenAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

describe('AssetsService', () => {
  let service: AssetsService;
  let cleanverse: {
    queryApass: jest.Mock;
    verifyApass: jest.Mock;
  };
  const assets = new Map<string, AssetEntity>();
  const liens = new Map<string, LienEntity>();
  const audits = new Map<string, AuditEventEntity>();

  beforeEach(async () => {
    assets.clear();
    liens.clear();
    audits.clear();

    cleanverse = {
      queryApass: jest.fn().mockResolvedValue({
        code: '0000',
        message: 'success',
        data: {
          cvRecordId: 'cvi-record-1',
          status: 1,
          tier: '2',
          expirationTime: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
      verifyApass: jest.fn().mockResolvedValue({
        code: '0000',
        message: 'success',
        data: {
          chain: 'base',
          atoken: invoice.atokenAddress,
          address: invoice.issuerWallet,
          code: 4,
          message: 'Valid A-Pass and transfer allowed',
        },
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        AssetsService,
        {
          provide: getRepositoryToken(AssetEntity),
          useValue: memoryRepo(assets),
        },
        {
          provide: getRepositoryToken(LienEntity),
          useValue: memoryRepo(liens),
        },
        {
          provide: getRepositoryToken(AuditEventEntity),
          useValue: memoryRepo(audits),
        },
        {
          provide: CleanverseService,
          useValue: cleanverse,
        },
      ],
    }).compile();

    service = module.get(AssetsService);
  });

  it('fingerprints, finances once, blocks second finance', async () => {
    const created = await service.createFingerprint(invoice);
    expect(created.fingerprint).toMatch(/^0x[a-f0-9]{64}$/);
    expect(created.isClean).toBe(true);

    const expected = createAssetFingerprint(invoice);
    expect(created.fingerprint).toBe(expected);

    const checkClean = await service.check({
      fingerprint: created.fingerprint,
    });
    expect(checkClean.isClean).toBe(true);

    const financed = await service.finance({
      fingerprint: created.fingerprint,
      lenderCvi: 'cvi:lender:bank-a',
      lenderWallet: '0x2222222222222222222222222222222222222222',
    });
    expect(financed.success).toBe(true);
    expect(financed.lien.priority).toBe(1);

    const checkDirty = await service.check({
      fingerprint: created.fingerprint,
    });
    expect(checkDirty.isClean).toBe(false);

    await expect(
      service.finance({
        fingerprint: created.fingerprint,
        lenderCvi: 'cvi:lender:bank-b',
        lenderWallet: '0x3333333333333333333333333333333333333333',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const audit = await service.listAudit(created.fingerprint);
    const types = audit.map((e) => e.type);
    expect(types).toContain('FINGERPRINT_CREATED');
    expect(types).toContain('LIEN_REGISTERED');
    expect(types).toContain('FINANCING_BLOCKED');
    expect(types.filter((type) => type === 'CVI_VERIFIED')).toHaveLength(3);

    const csv = await service.exportAudit(created.fingerprint, 'csv');
    expect(csv).toContain('eventId,type,fingerprint,assetId,createdAt,payload');
    expect(csv).toContain('FINANCING_BLOCKED');
  });

  it('fails closed and audits a frozen issuer A-Pass', async () => {
    cleanverse.queryApass.mockResolvedValueOnce({
      code: '0000',
      message: 'success',
      data: {
        cvRecordId: 'frozen-cvi',
        status: 2,
        expirationTime: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    await expect(service.createFingerprint(invoice)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(assets.size).toBe(0);
    expect(cleanverse.verifyApass).not.toHaveBeenCalled();

    const events = await service.listAudit();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('CVI_VERIFICATION_FAILED');
    expect(events[0]?.payload).toMatchObject({
      role: 'issuer',
      code: 'CVI_FROZEN',
    });
  });
});
