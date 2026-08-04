import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsNumberString,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  DATABASE_DRIVER?: string;

  @IsOptional()
  @IsString()
  DATABASE_PATH?: string;

  @IsOptional()
  @IsString()
  DATABASE_HOST?: string;

  @IsOptional()
  @IsNumberString()
  DATABASE_PORT?: string;

  @IsOptional()
  @IsString()
  DATABASE_USER?: string;

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DATABASE_NAME?: string;

  @IsOptional()
  @IsBooleanString()
  DATABASE_SYNC?: string;

  @IsOptional()
  @IsString()
  CLEANVERSE_DOCS_URL?: string;

  @IsOptional()
  @IsString()
  CLEANVERSE_DOCS_ACCESS_CODE?: string;

  @IsOptional()
  @IsString()
  CLEANVERSE_BASE_URL?: string;

  @IsOptional()
  @IsString()
  CLEANVERSE_API_ID?: string;

  @IsOptional()
  @IsString()
  CLEANVERSE_API_KEY?: string;

  @IsOptional()
  @IsString()
  DEMO_CHAIN?: string;

  @IsOptional()
  @IsString()
  DEMO_ATOKEN_ADDRESS?: string;

  @IsOptional()
  @IsString()
  DEMO_ISSUER_CVI?: string;

  @IsOptional()
  @IsString()
  DEMO_ISSUER_WALLET?: string;

  @IsOptional()
  @IsString()
  DEMO_DEBTOR_CVI?: string;

  @IsOptional()
  @IsString()
  DEMO_LENDER_A_CVI?: string;

  @IsOptional()
  @IsString()
  DEMO_LENDER_A_WALLET?: string;

  @IsOptional()
  @IsString()
  DEMO_LENDER_B_CVI?: string;

  @IsOptional()
  @IsString()
  DEMO_LENDER_B_WALLET?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: true,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validated;
}
