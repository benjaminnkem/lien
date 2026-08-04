import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { createAssetFingerprint } from "@repo/sdk";
import { AssetsService } from "./assets.service";
import { AssetEntity } from "./entities/asset.entity";
import { LienEntity } from "./entities/lien.entity";
import { AuditEventEntity } from "./entities/audit-event.entity";
import { CleanverseService } from "../cleanverse/cleanverse.service";

type Store<T extends { id: string }> = Map<string, T>;

function memoryRepo<T extends { id: string }>(store: Store<T>) {
  return {
    create: (data: Partial<T>) =>
      ({
        id: crypto.randomUUID(),
        ...data,
      }) as T,
    save: async (entity: T) => {
      store.set(entity.id, entity);
      return entity;
    },
    findOne: async (opts: {
      where: Partial<T> & Record<string, unknown>;
    }) => {
      const where = opts.where;
      for (const item of store.values()) {
        const match = Object.entries(where).every(
          ([k, v]) => (item as Record<string, unknown>)[k] === v,
        );
        if (match) return item;
      }
      return null;
    },
    findOneOrFail: async (opts: {
      where: Partial<T> & Record<string, unknown>;
    }) => {
      const found = await memoryRepo(store).findOne(opts);
      if (!found) throw new Error("not found");
      return found;
    },
    find: async (opts?: {
      where?: Partial<T> & Record<string, unknown>;
      order?: Record<string, "ASC" | "DESC">;
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
      return items;
    },
  };
}

const invoice = {
  issuerCvi: "cvi:issuer:acme",
  debtorCvi: "cvi:debtor:buyer",
  documentHash:
    "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  invoiceNumber: "INV-TEST-1",
  amount: "50000.00",
  currency: "USD",
  dueDate: "2026-12-31",
};

describe("AssetsService", () => {
  let service: AssetsService;
  const assets = new Map<string, AssetEntity>();
  const liens = new Map<string, LienEntity>();
  const audits = new Map<string, AuditEventEntity>();

  beforeEach(async () => {
    assets.clear();
    liens.clear();
    audits.clear();

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
          useValue: {
            verifyApass: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AssetsService);
  });

  it("fingerprints, finances once, blocks second finance", async () => {
    const created = await service.createFingerprint(invoice);
    expect(created.fingerprint).toMatch(/^0x[a-f0-9]{64}$/);
    expect(created.isClean).toBe(true);

    const expected = createAssetFingerprint(invoice);
    expect(created.fingerprint).toBe(expected);

    const checkClean = await service.check({ fingerprint: created.fingerprint });
    expect(checkClean.isClean).toBe(true);

    const financed = await service.finance({
      fingerprint: created.fingerprint,
      lenderCvi: "cvi:lender:bank-a",
      requireCleanverseVerify: false,
    });
    expect(financed.success).toBe(true);
    expect(financed.lien.priority).toBe(1);

    const checkDirty = await service.check({ fingerprint: created.fingerprint });
    expect(checkDirty.isClean).toBe(false);

    await expect(
      service.finance({
        fingerprint: created.fingerprint,
        lenderCvi: "cvi:lender:bank-b",
        requireCleanverseVerify: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const audit = await service.listAudit(created.fingerprint);
    const types = audit.map((e) => e.type);
    expect(types).toContain("FINGERPRINT_CREATED");
    expect(types).toContain("LIEN_REGISTERED");
    expect(types).toContain("FINANCING_BLOCKED");
  });
});
