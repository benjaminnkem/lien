import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { CleanverseModule } from './cleanverse/cleanverse.module';
import { ChainModule } from './chain/chain.module';
import { AssetsModule } from './assets/assets.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DemoModule } from './demo/demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('database.driver') ?? 'sqlite';
        const synchronize = config.get<boolean>('database.synchronize') ?? true;

        if (driver === 'postgres') {
          return {
            type: 'postgres' as const,
            host: config.get<string>('database.host'),
            port: config.get<number>('database.port'),
            username: config.get<string>('database.username'),
            password: config.get<string>('database.password'),
            database: config.get<string>('database.name'),
            autoLoadEntities: true,
            synchronize,
          };
        }

        const dbPath = resolve(
          process.cwd(),
          config.get<string>('database.path') ?? 'data/lien.sqlite',
        );
        mkdirSync(dirname(dbPath), { recursive: true });

        return {
          type: 'better-sqlite3' as const,
          database: dbPath,
          autoLoadEntities: true,
          synchronize,
        };
      },
    }),
    HealthModule,
    CleanverseModule,
    ChainModule,
    AssetsModule,
    DemoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
