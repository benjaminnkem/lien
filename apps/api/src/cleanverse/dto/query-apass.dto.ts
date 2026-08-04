import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class QueryApassDto {
  @ApiProperty({ example: "base", description: "Blockchain network" })
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
