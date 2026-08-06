import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class QueryAtokenListDto {
  @ApiProperty({
    example: "ethereum",
    description: "Cleanverse network name (ethereum = Sepolia in UAT).",
  })
  @IsString()
  @IsNotEmpty()
  chain!: string;

  @ApiPropertyOptional({
    example: "usdc",
    description: "Origin token symbol (not A-Token symbol)",
  })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({
    description: "Origin token contract address",
  })
  @IsOptional()
  @IsString()
  address?: string;
}
