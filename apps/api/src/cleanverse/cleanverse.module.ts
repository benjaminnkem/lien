import { Module } from "@nestjs/common";
import { CleanverseController } from "./cleanverse.controller";
import { CleanverseService } from "./cleanverse.service";

@Module({
  controllers: [CleanverseController],
  providers: [CleanverseService],
  exports: [CleanverseService],
})
export class CleanverseModule {}
