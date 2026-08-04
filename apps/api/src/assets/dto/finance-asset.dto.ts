import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { InvoiceFieldsDto } from "./invoice-fields.dto";

export class FinanceAssetDto {
  @ApiPropertyOptional({
    description: "Existing fingerprint (preferred if already created)",
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
    example: "cvi:lender:bank-001",
    description: "Lender CVI / identity ref",
  })
  @IsString()
  @IsNotEmpty()
  lenderCvi!: string;

  @ApiPropertyOptional({ description: "Lender wallet address" })
  @IsOptional()
  @IsString()
  lenderWallet?: string;

  @ApiPropertyOptional({ example: "base" })
  @IsOptional()
  @IsString()
  chain?: string;

  @ApiPropertyOptional({
    description: "A-Token (CVA) contract to verify parties against",
  })
  @IsOptional()
  @IsString()
  atokenAddress?: string;

  @ApiPropertyOptional({
    description: "Optional CVA / mint id once issued",
  })
  @IsOptional()
  @IsString()
  cvaId?: string;

  @ApiPropertyOptional({
    description: "On-chain lien registration tx hash (optional)",
  })
  @IsOptional()
  @IsString()
  txHash?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      "If true and wallets+atoken provided, call Cleanverse verify_apass for lender",
  })
  @IsOptional()
  @IsBoolean()
  requireCleanverseVerify?: boolean;
}
