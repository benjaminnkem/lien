import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { AssetEntity } from "./entities/asset.entity";
import { LienEntity } from "./entities/lien.entity";
import { AuditEventEntity } from "./entities/audit-event.entity";
import { CleanverseModule } from "../cleanverse/cleanverse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetEntity, LienEntity, AuditEventEntity]),
    CleanverseModule,
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
