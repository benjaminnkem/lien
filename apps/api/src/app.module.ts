import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import configuration from "./config/configuration";
import { validate } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { CleanverseModule } from "./cleanverse/cleanverse.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: [".env.local", ".env", "../../.env"],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        host: config.get<string>("database.host"),
        port: config.get<number>("database.port"),
        username: config.get<string>("database.username"),
        password: config.get<string>("database.password"),
        database: config.get<string>("database.name"),
        autoLoadEntities: true,
        synchronize: config.get<boolean>("database.synchronize"),
      }),
    }),
    HealthModule,
    CleanverseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
