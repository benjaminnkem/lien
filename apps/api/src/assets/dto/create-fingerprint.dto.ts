import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InvoiceFieldsDto } from './invoice-fields.dto';

export class CreateFingerprintDto extends InvoiceFieldsDto {
  @ApiProperty({ example: 'base' })
  @IsString()
  @IsNotEmpty()
  chain!: string;

  @ApiProperty({ description: 'Issuer wallet holding the Cleanverse A-Pass' })
  @IsString()
  @IsNotEmpty()
  issuerWallet!: string;

  @ApiProperty({
    description: 'A-Token contract used for Cleanverse transfer eligibility',
  })
  @IsString()
  @IsNotEmpty()
  atokenAddress!: string;

  @ApiPropertyOptional({ description: 'Debtor wallet for Cleanverse A-Pass' })
  @IsOptional()
  @IsString()
  debtorWallet?: string;
}
