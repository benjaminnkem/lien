import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SeedDemoDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Attempt a second financing and capture the expected block',
  })
  @IsOptional()
  @IsBoolean()
  includeConflict?: boolean;
}
