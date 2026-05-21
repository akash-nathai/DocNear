import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 10;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** POST /v1/reviews — patient posts a review after COMPLETED booking */
  @Post()
  createReview(@CurrentUser() user: RequestUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.id, dto);
  }

  /** GET /v1/reviews/me — patient's own reviews */
  @Get('me')
  listMyReviews(@CurrentUser() user: RequestUser, @Query() q: PaginationQuery) {
    return this.reviewsService.listMyReviews(user.id, q.page, q.limit);
  }

  /** GET /v1/reviews/doctor/:doctorId — public doctor reviews */
  @Get('doctor/:doctorId')
  listByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() q: PaginationQuery,
  ) {
    return this.reviewsService.listByDoctor(doctorId, q.page, q.limit);
  }

  /** PATCH /v1/reviews/:id/hide — admin hides a review */
  @Patch(':id/hide')
  @HttpCode(HttpStatus.OK)
  hideReview(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviewsService.hideReview(id, user.role);
  }
}
