import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class QueryAtokenListDto {
  @ApiProperty({ example: "base" })
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
