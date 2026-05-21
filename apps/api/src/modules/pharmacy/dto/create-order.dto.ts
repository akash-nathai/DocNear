import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DeliveryAddressDto {
  @IsString() @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MaxLength(100) city!: string;
  @IsString() @MaxLength(100) state!: string;
  @IsString() @MaxLength(10)  pincode!: string;
}

export class CreatePharmacyOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress!: DeliveryAddressDto;

  @IsOptional() @IsString() @MaxLength(30)
  couponCode?: string;

  /** S3 key of uploaded Rx image (required if any item needs prescription) */
  @IsOptional() @IsString()
  prescriptionUrl?: string;

  @IsOptional() @IsString() @MaxLength(300)
  notes?: string;
}
