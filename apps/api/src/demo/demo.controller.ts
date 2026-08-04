import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { SeedDemoDto } from './dto/seed-demo.dto';

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get public demo sandbox identity configuration' })
  @ApiOkResponse({ description: 'Public wallet and A-Token configuration' })
  config() {
    return this.demo.getPublicConfig();
  }

  @Post('seed')
  @ApiOperation({
    summary: 'Seed a verified invoice, first lien, and optional conflict',
  })
  @ApiOkResponse({ description: 'Complete demo scenario created' })
  @ApiServiceUnavailableResponse({
    description: 'Demo wallets or A-Token are not configured',
  })
  seed(@Body() body: SeedDemoDto) {
    return this.demo.seed(body);
  }
}
