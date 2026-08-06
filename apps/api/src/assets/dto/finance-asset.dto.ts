import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { InvoiceFieldsDto } from './invoice-fields.dto';

export class FinanceAssetDto {
  @ApiPropertyOptional({
    description: 'Existing fingerprint (preferred if already created)',
  })
  @ValidateIf((o: FinanceAssetDto) => !o.fields)
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  fingerprint?: string;

  @ApiPropertyOptional({ type: InvoiceFieldsDto })
  @ValidateIf((o: FinanceAssetDto) => !o.fingerprint)
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceFieldsDto)
  fields?: InvoiceFieldsDto;

  @ApiProperty({
    example: 'cvi:lender:bank-001',
    description: 'Lender CVI / identity ref',
  })
  @IsString()
  @IsNotEmpty()
  lenderCvi!: string;

  @ApiProperty({ description: 'Lender wallet holding the Cleanverse A-Pass' })
  @IsString()
  @IsNotEmpty()
  lenderWallet!: string;

  @ApiPropertyOptional({
    example: 'ethereum',
    description: 'Cleanverse network name (ethereum = Sepolia in UAT).',
  })
  @IsOptional()
  @IsString()
  chain?: string;

  @ApiPropertyOptional({
    description: 'A-Token (CVA) contract to verify parties against',
  })
  @IsOptional()
  @IsString()
  atokenAddress?: string;

  @ApiPropertyOptional({
    description: 'Optional CVA / mint id once issued',
  })
  @IsOptional()
  @IsString()
  cvaId?: string;

  @ApiPropertyOptional({
    description: 'On-chain lien registration tx hash (optional)',
  })
  @IsOptional()
  @IsString()
  txHash?: string;
}
