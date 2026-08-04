import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { InvoiceFieldsDto } from "./invoice-fields.dto";

export class CreateFingerprintDto extends InvoiceFieldsDto {
  @ApiPropertyOptional({ example: "base" })
  @IsOptional()
  @IsString()
  chain?: string;

  @ApiPropertyOptional({ description: "Issuer wallet for Cleanverse A-Pass" })
  @IsOptional()
  @IsString()
  issuerWallet?: string;

  @ApiPropertyOptional({ description: "Debtor wallet for Cleanverse A-Pass" })
  @IsOptional()
  @IsString()
  debtorWallet?: string;
}
