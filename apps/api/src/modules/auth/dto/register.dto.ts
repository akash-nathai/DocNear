import {
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Only PATIENT and DOCTOR can self-register; SUPER_ADMIN is seeded
export enum RegisterRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  /**
   * E.164 phone format: +91XXXXXXXXXX
   */
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be in E.164 format (e.g. +919876543210)',
  })
  phone!: string;

  /**
   * Min 8 chars, at least one uppercase, one lowercase, one digit, one special char.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt limit
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName!: string;

  @IsEnum(RegisterRole)
  role!: RegisterRole;
}
