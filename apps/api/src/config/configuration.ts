export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5433', 10),
    username: process.env.DATABASE_USER ?? 'lien',
    password: process.env.DATABASE_PASSWORD ?? 'lien',
    name: process.env.DATABASE_NAME ?? 'lien',
    synchronize: (process.env.DATABASE_SYNC ?? 'true') === 'true',
  },
});
