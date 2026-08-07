import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class IssueCvaDto {
  @ApiProperty({
    description: 'Asset fingerprint that must be clean before CVA issuance',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/)
  fingerprint!: string;

  @ApiPropertyOptional({
    description:
      'Admin wallet for the launched A-Token. Defaults to CVA_ADMIN_ADDRESS or the chain registrar.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  adminAddress?: string;
}
