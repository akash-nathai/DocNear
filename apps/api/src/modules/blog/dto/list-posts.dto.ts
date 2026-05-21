import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BlogStatus } from '@prisma/client';

export class ListPostsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 12;

  @IsOptional() @IsString()
  categorySlug?: string;

  @IsOptional() @IsString()
  specialitySlug?: string;

  @IsOptional() @IsString()
  tag?: string;

  @IsOptional() @IsEnum(BlogStatus)
  status?: BlogStatus;
}
