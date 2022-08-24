import { plainToClass } from 'class-transformer';
import { IsString, IsUrl, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsUrl()
  RPC_URL: string;

  @IsString()
  WALLET_SECRET_PHRASE: string;

  @IsString()
  WALLET_PASSWORD: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config);

  const validatorOptions = { skipMissingProperties: false };
  const errors = validateSync(validatedConfig, validatorOptions);

  if (errors.length > 0) {
    console.error(errors.toString());
    process.exit(1);
  }

  return validatedConfig;
}
