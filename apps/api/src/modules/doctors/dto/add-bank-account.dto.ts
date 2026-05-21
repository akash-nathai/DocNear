import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AddBankAccountDto {
  /** Full account number — stored AES-256 encrypted; last 4 digits kept for display */
  @IsString()
  @Matches(/^\d{9,18}$/, { message: 'accountNumber must be 9–18 digits' })
  accountNumber!: string;

  /** Bank IFSC code */
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC code format' })
  ifscCode!: string;

  /** Account holder name as on cheque */
  @IsString()
  @MaxLength(100)
  holderName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  /** Whether this account should be the primary payout account */
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
