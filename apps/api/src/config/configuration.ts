function parseDatabaseUrl(url: string | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '5432', 10),
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      name: u.pathname.replace(/^\//, '') || 'lien',
    };
  } catch {
    return null;
  }
}

const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);

export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  database: {
    // Prefer postgres when DATABASE_URL is set (Render/Railway/etc.)
    driver:
      process.env.DATABASE_DRIVER ??
      (databaseUrl ? 'postgres' : 'sqlite'),
    path: process.env.DATABASE_PATH ?? 'data/lien.sqlite',
    host: process.env.DATABASE_HOST ?? databaseUrl?.host ?? 'localhost',
    port: parseInt(
      process.env.DATABASE_PORT ?? String(databaseUrl?.port ?? 5432),
      10,
    ),
    username:
      process.env.DATABASE_USER ?? databaseUrl?.username ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? databaseUrl?.password ?? '',
    name: process.env.DATABASE_NAME ?? databaseUrl?.name ?? 'lien',
    synchronize: (process.env.DATABASE_SYNC ?? 'true') === 'true',
    ssl:
      (process.env.DATABASE_SSL ??
        (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
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
    chain: process.env.DEMO_CHAIN ?? 'ethereum',
    conflictChain: process.env.DEMO_CONFLICT_CHAIN ?? 'base',
    atokenAddress:
      process.env.DEMO_ATOKEN_ADDRESS ??
      '0xaC0893567D43C3E7e6e35a72803df05416C1f20D',
    issuerCvi: process.env.DEMO_ISSUER_CVI ?? 'cvi:issuer:atlas-manufacturing',
    debtorCvi: process.env.DEMO_DEBTOR_CVI ?? 'cvi:debtor:northline-retail',
    lenderACvi: process.env.DEMO_LENDER_A_CVI ?? 'cvi:lender:northstar-capital',
    lenderBCvi: process.env.DEMO_LENDER_B_CVI ?? 'cvi:lender:meridian-credit',
  },
  chain: {
    enabled: (process.env.CHAIN_ENABLED ?? 'false') === 'true',
    rpcUrl: process.env.CHAIN_RPC_URL ?? process.env.SEPOLIA_RPC_URL ?? '',
    registryAddress: process.env.ENCUMBRANCE_REGISTRY_ADDRESS ?? '',
    privateKey: process.env.CHAIN_PRIVATE_KEY ?? '',
    chainId: parseInt(process.env.CHAIN_ID ?? '11155111', 10),
  },
  cva: {
    adminAddress: process.env.CVA_ADMIN_ADDRESS ?? '',
    iconUrl:
      process.env.CVA_ICON_URL ??
      'https://images.cleanverse.com/app/token_icon/USDC.svg',
    pollAttempts: parseInt(process.env.CVA_POLL_ATTEMPTS ?? '8', 10),
    pollIntervalMs: parseInt(process.env.CVA_POLL_INTERVAL_MS ?? '2500', 10),
  },
  lien: {
    enabled: (process.env.LIEN_ENABLED ?? 'true') !== 'false',
    /** demo = labeled mock Cleanverse gates (local); live = real CVI/CCP */
    trustMode: process.env.LIEN_TRUST_MODE ?? '',
    /**
     * When true, empty/error Cleanverse /validator/verify fails the gate.
     * Default false: verified CVI (A-Pass) is sufficient if CCP payload is empty (common in UAT).
     */
    requireCcp: (process.env.LIEN_REQUIRE_CCP ?? 'false') === 'true',
    rpcUrl:
      process.env.LIEN_RPC_URL ??
      process.env.CHAIN_RPC_URL ??
      process.env.SEPOLIA_RPC_URL ??
      'http://127.0.0.1:8545',
    chainId: parseInt(process.env.LIEN_CHAIN_ID ?? process.env.CHAIN_ID ?? '31337', 10),
    privateKey:
      process.env.LIEN_PRIVATE_KEY ?? process.env.CHAIN_PRIVATE_KEY ?? '',
    registryAddress: process.env.LIEN_REGISTRY_ADDRESS ?? '',
    guardAddress: process.env.LIEN_GUARD_ADDRESS ?? '',
    protocolAAddress: process.env.LIEN_PROTOCOL_A_ADDRESS ?? '',
    protocolBAddress: process.env.LIEN_PROTOCOL_B_ADDRESS ?? '',
    tokenAddress: process.env.LIEN_TOKEN_ADDRESS ?? '',
    priorityBookAddress: process.env.LIEN_PRIORITY_BOOK_ADDRESS ?? '',
    crossChainMockAddress: process.env.LIEN_XCHAIN_MOCK_ADDRESS ?? '',
    atokenAddress:
      process.env.LIEN_ATOKEN_ADDRESS ?? process.env.DEMO_ATOKEN_ADDRESS ?? '',
  },
});
