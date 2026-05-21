import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BlogStatus } from '@prisma/client';

export class CreatePostDto {
  @IsString() @MaxLength(200)
  title!: string;

  @IsString() @MaxLength(100)
  slug!: string;

  @IsOptional() @IsString() @MaxLength(400)
  excerpt?: string;

  @IsString()
  contentMarkdown!: string;

  @IsOptional() @IsString()
  coverImageUrl?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsUUID()
  specialityId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString() @MaxLength(200)
  seoTitle?: string;

  @IsOptional() @IsString() @MaxLength(400)
  seoDescription?: string;

  @IsOptional() @IsInt() @Min(1)
  estimatedReadMinutes?: number;

  @IsOptional() @IsEnum(BlogStatus)
  status?: BlogStatus;
}

export class UpdatePostDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString()
  contentMarkdown?: string;

  @IsOptional() @IsString() @MaxLength(400)
  excerpt?: string;

  @IsOptional() @IsString()
  coverImageUrl?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsEnum(BlogStatus)
  status?: BlogStatus;

  @IsOptional() @IsString() @MaxLength(200)
  seoTitle?: string;

  @IsOptional() @IsString() @MaxLength(400)
  seoDescription?: string;
}
