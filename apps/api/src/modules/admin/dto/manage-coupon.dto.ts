import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CouponApplicable, CouponType } from '@prisma/client';

export class CreateCouponDto {
  @IsString()
  @MaxLength(30)
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;

  @IsEnum(CouponApplicable)
  applicableTo!: CouponApplicable;

  /** Paise for FLAT; percentage points for PERCENT */
  @IsInt()
  @Min(1)
  value!: number;

  @IsOptional() @IsInt() @Min(0)
  minOrderAmount?: number;

  /** Only for PERCENT coupons — max discount in paise */
  @IsOptional() @IsInt() @Min(1)
  maxDiscount?: number;

  @IsOptional() @IsInt() @Min(1)
  usageLimit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  perUserLimit?: number;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;
}

export class UpdateCouponDto {
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsDateString()
  validUntil?: string;

  @IsOptional() @IsInt() @Min(1)
  usageLimit?: number;
}
