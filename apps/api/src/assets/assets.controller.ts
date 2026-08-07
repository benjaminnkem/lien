import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateFingerprintDto } from './dto/create-fingerprint.dto';
import { CheckEncumbranceDto } from './dto/check-encumbrance.dto';
import { FinanceAssetDto } from './dto/finance-asset.dto';
import { IssueCvaDto } from './dto/issue-cva.dto';
import { AuditExportQueryDto } from './dto/audit-export-query.dto';
import type { Response } from 'express';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post('fingerprint')
  @ApiOperation({
    summary: 'Create asset fingerprint',
    description:
      'Hashes invoice fields into a privacy-preserving fingerprint and registers it in the Lien registry.',
  })
  @ApiOkResponse({ description: 'Fingerprint created or already known' })
  createFingerprint(@Body() body: CreateFingerprintDto) {
    return this.assets.createFingerprint(body);
  }

  @Post('check')
  @ApiOperation({
    summary: 'Check encumbrance registry',
    description:
      'Returns whether the underlying asset is clean or already has an active first-priority lien.',
  })
  @ApiOkResponse({ description: 'Encumbrance check result' })
  check(@Body() body: CheckEncumbranceDto) {
    return this.assets.check(body);
  }

  @Post('cva/issue')
  @ApiOperation({
    summary: 'Issue invoice as Cleanverse CVA (A-Token)',
    description:
      'Requires a clean fingerprint. Submits Cleanverse atoken/launch, polls until ISSUED (minted) or returns pending minting status.',
  })
  @ApiOkResponse({ description: 'CVA issuance submitted or completed' })
  issueCva(@Body() body: IssueCvaDto) {
    return this.assets.issueCva(body);
  }

  @Post('cva/status')
  @ApiOperation({
    summary: 'Refresh CVA issuance status from Cleanverse',
  })
  refreshCva(@Body() body: IssueCvaDto) {
    return this.assets.refreshCvaStatus(body.fingerprint);
  }

  @Get(':fingerprint/cva')
  @ApiOperation({ summary: 'Get CVA status for a fingerprint (refresh if minting)' })
  @ApiParam({ name: 'fingerprint' })
  async getCva(@Param('fingerprint') fingerprint: string) {
    const asset = await this.assets.getByFingerprint(fingerprint);
    if (!asset.cva?.requestId) {
      return {
        fingerprint: asset.fingerprint,
        status: asset.status,
        cva: asset.cva,
        started: false,
      };
    }
    if (asset.status === 'minting') {
      return this.assets.refreshCvaStatus(fingerprint);
    }
    return {
      fingerprint: asset.fingerprint,
      status: asset.status,
      cva: asset.cva,
      started: true,
    };
  }

  @Post('finance')
  @ApiOperation({
    summary: 'Register first-priority lien (finance)',
    description:
      'Finances a minted CVA: registers a first-priority lien. Requires status minted. A second attempt on the same fingerprint is blocked globally.',
  })
  @ApiOkResponse({ description: 'Lien registered successfully' })
  @ApiConflictResponse({
    description: 'FINANCING_BLOCKED — asset already encumbered',
  })
  @ApiNotFoundResponse({ description: 'Fingerprint not registered' })
  finance(@Body() body: FinanceAssetDto) {
    return this.assets.finance(body);
  }

  @Get()
  @ApiOperation({ summary: 'List recent assets' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  list(@Query('limit') limit?: string) {
    return this.assets.listAssets(limit ? Number(limit) : 50);
  }

  @Get('audit')
  @ApiOperation({ summary: 'List audit / compliance events' })
  @ApiQuery({ name: 'fingerprint', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  audit(
    @Query('fingerprint') fingerprint?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assets.listAudit(fingerprint, limit ? Number(limit) : 50);
  }

  @Get('audit/export')
  @ApiOperation({ summary: 'Export audit evidence as CSV or JSON' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  @ApiQuery({ name: 'fingerprint', required: false })
  async exportAudit(
    @Query() query: AuditExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const format = query.format ?? 'csv';
    const result = await this.assets.exportAudit(
      query.fingerprint,
      format,
      query.limit ? Number(query.limit) : 200,
    );
    const scope = query.fingerprint
      ? query.fingerprint.slice(2, 14)
      : 'all-assets';
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="lien-audit-${scope}.${format}"`,
    );
    if (format === 'csv') {
      response.type('text/csv; charset=utf-8');
    } else {
      response.type('application/json');
    }
    return result;
  }

  @Get(':fingerprint')
  @ApiOperation({ summary: 'Get asset by fingerprint' })
  @ApiParam({
    name: 'fingerprint',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  @ApiNotFoundResponse({ description: 'Asset not found' })
  getOne(@Param('fingerprint') fingerprint: string) {
    return this.assets.getByFingerprint(fingerprint);
  }
}
