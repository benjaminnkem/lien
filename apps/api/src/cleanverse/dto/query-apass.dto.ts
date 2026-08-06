import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class QueryApassDto {
  @ApiProperty({
    example: "ethereum",
    description:
      "Blockchain network. Lien demo uses ethereum (Ethereum Sepolia in Cleanverse UAT).",
  })
  @IsString()
  @IsNotEmpty()
  chain!: string;

  @ApiProperty({
    example: "0x5702b24116718DCF49314231222A33403e88Aff8",
    description: "Wallet address",
  })
  @IsString()
  @IsNotEmpty()
  address!: string;
}
