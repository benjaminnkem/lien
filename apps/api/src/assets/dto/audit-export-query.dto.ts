import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional, Matches } from 'class-validator';

export class AuditExportQueryDto {
  @ApiPropertyOptional({
    enum: ['csv', 'json'],
    default: 'csv',
  })
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @ApiPropertyOptional({ description: 'Scope the export to one fingerprint' })
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  fingerprint?: string;

  @ApiPropertyOptional({ default: 200, maximum: 200 })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
