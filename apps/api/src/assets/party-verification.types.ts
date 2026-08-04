export type PartyVerificationEvidence = {
  role: 'issuer' | 'lender';
  wallet: string;
  chain: string;
  atokenAddress: string;
  cvRecordId: string | null;
  tier: string | number | null;
  subTier: number | null;
  group: string | null;
  status: number;
  expirationTime: number | null;
  verifyCode: number;
  verifyMessage: string;
  verifiedAt: string;
};
