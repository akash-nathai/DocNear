import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  bookingId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  /**
   * Freeform tags e.g. ['Knowledgeable', 'Punctual', 'Caring']
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
