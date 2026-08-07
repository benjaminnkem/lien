import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CleanverseModule } from "../cleanverse/cleanverse.module";
import { LienAuditEvent } from "./entities/lien-audit-event.entity";
import { LienAuditService } from "./lien-audit.service";
import { LienComplianceService } from "./lien-compliance.service";
import { LienController } from "./lien.controller";
import { LienService } from "./lien.service";

@Module({
  imports: [CleanverseModule, TypeOrmModule.forFeature([LienAuditEvent])],
  controllers: [LienController],
  providers: [LienService, LienComplianceService, LienAuditService],
  exports: [LienService],
})
export class LienModule {}
