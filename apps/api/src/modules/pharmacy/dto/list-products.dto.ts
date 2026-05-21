import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListProductsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  categoryId?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  prescriptionRequired?: boolean;
}
