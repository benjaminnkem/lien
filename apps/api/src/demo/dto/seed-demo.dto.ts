import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SeedDemoDto {
  @ApiProperty({ description: 'Issuer wallet with active Cleanverse A-Pass' })
  @IsString()
  @IsNotEmpty()
  issuerWallet!: string;

  @ApiProperty({ description: 'First lender wallet with active Cleanverse A-Pass' })
  @IsString()
  @IsNotEmpty()
  lenderAWallet!: string;

  @ApiProperty({
    description: 'Second lender wallet used for the conflict attempt',
  })
  @IsString()
  @IsNotEmpty()
  lenderBWallet!: string;

  @ApiPropertyOptional({ description: 'Optional issuer CVI label' })
  @IsOptional()
  @IsString()
  issuerCvi?: string;

  @ApiPropertyOptional({ description: 'Optional debtor CVI label' })
  @IsOptional()
  @IsString()
  debtorCvi?: string;

  @ApiPropertyOptional({ description: 'Optional first lender CVI label' })
  @IsOptional()
  @IsString()
  lenderACvi?: string;

  @ApiPropertyOptional({ description: 'Optional second lender CVI label' })
  @IsOptional()
  @IsString()
  lenderBCvi?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Attempt a second financing and capture the expected block',
  })
  @IsOptional()
  @IsBoolean()
  includeConflict?: boolean;
}
