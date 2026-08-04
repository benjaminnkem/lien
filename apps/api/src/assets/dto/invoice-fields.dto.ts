import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class InvoiceFieldsDto {
  @ApiProperty({
    example: "cvi:issuer:acme-001",
    description: "Issuer CVI / A-Pass identity ref",
  })
  @IsString()
  @IsNotEmpty()
  issuerCvi!: string;

  @ApiProperty({
    example: "cvi:debtor:buyer-001",
    description: "Debtor CVI / A-Pass identity ref",
  })
  @IsString()
  @IsNotEmpty()
  debtorCvi!: string;

  @ApiProperty({
    example:
      "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    description: "Hash of the invoice document",
  })
  @IsString()
  @IsNotEmpty()
  documentHash!: string;

  @ApiProperty({ example: "INV-2026-0001" })
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @ApiProperty({ example: "100000.00", description: "Decimal string" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: "amount must be a decimal string" })
  amount!: string;

  @ApiPropertyOptional({ example: "USD", default: "USD" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: "currency must be a 3-letter code" })
  currency?: string;

  @ApiProperty({ example: "2026-12-31", description: "ISO date YYYY-MM-DD" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "dueDate must be YYYY-MM-DD",
  })
  dueDate!: string;
}
