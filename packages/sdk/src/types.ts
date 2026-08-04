import { z } from "zod";

export const AssetStatusSchema = z.enum([
  "draft",
  "fingerprinted",
  "clean",
  "encumbered",
  "minted",
  "financed",
  "blocked",
]);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const PartyRoleSchema = z.enum(["issuer", "debtor", "lender"]);
export type PartyRole = z.infer<typeof PartyRoleSchema>;

export const InvoiceFieldsSchema = z.object({
  issuerCvi: z.string().min(1),
  debtorCvi: z.string().min(1),
  documentHash: z.string().min(1),
  invoiceNumber: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(3).max(3).default("USD"),
  dueDate: z.string().min(1),
});
export type InvoiceFields = z.infer<typeof InvoiceFieldsSchema>;

export const AssetFingerprintSchema = z.object({
  fingerprint: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  fields: InvoiceFieldsSchema,
  createdAt: z.string().datetime().optional(),
});
export type AssetFingerprint = z.infer<typeof AssetFingerprintSchema>;

export const EncumbranceCheckResultSchema = z.object({
  fingerprint: z.string(),
  isClean: z.boolean(),
  status: AssetStatusSchema,
  existingLienId: z.string().nullable().optional(),
  reason: z.string().optional(),
});
export type EncumbranceCheckResult = z.infer<
  typeof EncumbranceCheckResultSchema
>;

export const LienRecordSchema = z.object({
  id: z.string(),
  fingerprint: z.string(),
  lenderCvi: z.string(),
  priority: z.number().int().positive(),
  cvaId: z.string().optional(),
  registeredAt: z.string(),
  txHash: z.string().optional(),
});
export type LienRecord = z.infer<typeof LienRecordSchema>;

export const AuditEventTypeSchema = z.enum([
  "FINGERPRINT_CREATED",
  "ENCUMBRANCE_CHECKED",
  "CVA_MINTED",
  "LIEN_REGISTERED",
  "FINANCING_BLOCKED",
  "CVI_VERIFIED",
  "CVI_VERIFICATION_FAILED",
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
