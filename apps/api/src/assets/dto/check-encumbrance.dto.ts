import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { InvoiceFieldsDto } from "./invoice-fields.dto";

export class CheckEncumbranceDto {
  @ApiPropertyOptional({
    example:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    description: "Existing asset fingerprint (alternative to invoice fields)",
  })
  @ValidateIf((o: CheckEncumbranceDto) => !o.fields)
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  fingerprint?: string;

  @ApiPropertyOptional({ type: InvoiceFieldsDto })
  @ValidateIf((o: CheckEncumbranceDto) => !o.fingerprint)
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceFieldsDto)
  fields?: InvoiceFieldsDto;
}
