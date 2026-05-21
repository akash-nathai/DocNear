import { IsArray, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

enum Relation {
  SPOUSE = 'SPOUSE',
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  SIBLING = 'SIBLING',
  OTHER = 'OTHER',
}

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export class CreateFamilyMemberDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(Relation)
  relation!: string;

  @IsOptional()
  @IsISO8601()
  dob?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];
}
