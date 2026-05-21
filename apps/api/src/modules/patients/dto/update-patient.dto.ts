import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

enum BloodGroup {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  O_POS = 'O+',
  O_NEG = 'O-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
}

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export class UpdatePatientDto {
  @IsOptional()
  @IsISO8601()
  dob?: string; // YYYY-MM-DD — will be encrypted

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  allergies?: string; // will be encrypted

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chronicConditions?: string; // will be encrypted
}
