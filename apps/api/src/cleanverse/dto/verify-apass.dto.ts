import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class VerifyApassDto {
  @ApiProperty({
    example: "ethereum",
    description: "Cleanverse network name (ethereum = Sepolia in UAT).",
  })
  @IsString()
  @IsNotEmpty()
  chain!: string;

  @ApiProperty({
    example: "0xaC0893567D43C3E7e6e35a72803df05416C1f20D",
    description: "A-Token (CVA) contract address",
  })
  @IsString()
  @IsNotEmpty()
  atoken!: string;

  @ApiProperty({
    example: "0x5702b24116718DCF49314231222A33403e88Aff8",
    description: "User wallet address",
  })
  @IsString()
  @IsNotEmpty()
  address!: string;
}
