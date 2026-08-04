import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AssetsModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
