export default () => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  database: {
    driver: process.env.DATABASE_DRIVER ?? "sqlite",
    path: process.env.DATABASE_PATH ?? "data/lien.sqlite",
    host: process.env.DATABASE_HOST ?? "localhost",
    port: parseInt(process.env.DATABASE_PORT ?? "5432", 10),
    username: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "",
    name: process.env.DATABASE_NAME ?? "lien",
    synchronize: (process.env.DATABASE_SYNC ?? "true") === "true",
  },
  cleanverse: {
    docsUrl: process.env.CLEANVERSE_DOCS_URL ?? "https://docs.cleanverse.com",
    docsAccessCode: process.env.CLEANVERSE_DOCS_ACCESS_CODE ?? "",
    baseUrl:
      process.env.CLEANVERSE_BASE_URL ??
      "https://uatapi.cleanverse.com/api/cooperate",
    apiId: process.env.CLEANVERSE_API_ID ?? "",
    apiKey: process.env.CLEANVERSE_API_KEY ?? "",
  },
});
