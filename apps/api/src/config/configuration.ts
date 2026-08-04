export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  database: {
    driver: process.env.DATABASE_DRIVER ?? 'sqlite',
    path: process.env.DATABASE_PATH ?? 'data/lien.sqlite',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? '',
    name: process.env.DATABASE_NAME ?? 'lien',
    synchronize: (process.env.DATABASE_SYNC ?? 'true') === 'true',
  },
  cleanverse: {
    docsUrl: process.env.CLEANVERSE_DOCS_URL ?? 'https://docs.cleanverse.com',
    docsAccessCode: process.env.CLEANVERSE_DOCS_ACCESS_CODE ?? '',
    baseUrl:
      process.env.CLEANVERSE_BASE_URL ??
      'https://uatapi.cleanverse.com/api/cooperate',
    apiId: process.env.CLEANVERSE_API_ID ?? '',
    apiKey: process.env.CLEANVERSE_API_KEY ?? '',
  },
  demo: {
    chain: process.env.DEMO_CHAIN ?? 'base',
    atokenAddress: process.env.DEMO_ATOKEN_ADDRESS ?? '',
    issuerCvi: process.env.DEMO_ISSUER_CVI ?? 'cvi:issuer:atlas-manufacturing',
    issuerWallet: process.env.DEMO_ISSUER_WALLET ?? '',
    debtorCvi: process.env.DEMO_DEBTOR_CVI ?? 'cvi:debtor:northline-retail',
    lenderACvi: process.env.DEMO_LENDER_A_CVI ?? 'cvi:lender:northstar-capital',
    lenderAWallet: process.env.DEMO_LENDER_A_WALLET ?? '',
    lenderBCvi: process.env.DEMO_LENDER_B_CVI ?? 'cvi:lender:meridian-credit',
    lenderBWallet: process.env.DEMO_LENDER_B_WALLET ?? '',
  },
});
