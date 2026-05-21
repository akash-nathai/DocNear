import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingStatus, Role } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * POST /v1/reviews
   * Only allowed once per COMPLETED booking by the booking's patient.
   * Atomically updates doctor avgRating + totalReviews.
   */
  async createReview(userId: string, dto: CreateReviewDto) {
    // 1. Verify booking belongs to this patient and is COMPLETED
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { patient: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.patient.userId !== userId) throw new ForbiddenException('Access denied');
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('You can only review a completed consultation');
    }

    // 2. One review per booking
    const existing = await this.prisma.review.findUnique({ where: { bookingId: dto.bookingId } });
    if (existing) throw new ConflictException('You have already reviewed this consultation');

    // 3. Create review + update doctor rating atomically
    const reviewId = randomUUID();

    const [review] = await this.prisma.$transaction([
      this.prisma.review.create({
        data: {
          id: reviewId,
          bookingId: dto.bookingId,
          doctorId: booking.doctorId,
          patientId: booking.patientId,
          rating: dto.rating,
          comment: dto.comment ?? null,
          tags: dto.tags ?? [],
        },
        include: {
          doctor: { include: { user: true } },
        },
      }),
      // Atomically recalculate avgRating: (oldAvg * oldCount + newRating) / (oldCount + 1)
      this.prisma.$executeRaw`
        UPDATE doctor_profiles
        SET
          avg_rating    = (avg_rating * total_reviews + ${dto.rating}::float) / (total_reviews + 1),
          total_reviews = total_reviews + 1
        WHERE id = ${booking.doctorId}
      `,
    ]);

    return {
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      comment: review.comment,
      tags: review.tags,
      doctorName: `${review.doctor.user.firstName} ${review.doctor.user.lastName}`,
      createdAt: review.createdAt,
    };
  }

  // ── List by doctor ────────────────────────────────────────────────────────

  async listByDoctor(
    doctorId: string,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { doctorId, isVisible: true },
        include: { patient: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { doctorId, isVisible: true } }),
    ]);

    return {
      data: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        tags: r.tags,
        patientName: `${r.patient.user.firstName} ${r.patient.user.lastName}`,
        createdAt: r.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── List by patient (my reviews) ──────────────────────────────────────────

  async listMyReviews(userId: string, page = 1, limit = 10) {
    const patient = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!patient) return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };

    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { patientId: patient.id },
        include: { doctor: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { patientId: patient.id } }),
    ]);

    return {
      data: reviews.map(r => ({
        id: r.id,
        bookingId: r.bookingId,
        rating: r.rating,
        comment: r.comment,
        tags: r.tags,
        doctorName: `${r.doctor.user.firstName} ${r.doctor.user.lastName}`,
        doctorSlug: r.doctor.slug,
        createdAt: r.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Admin: hide a review ──────────────────────────────────────────────────

  async hideReview(reviewId: string, role: string) {
    if (role !== Role.SUPER_ADMIN) throw new ForbiddenException('Access denied');
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.update({ where: { id: reviewId }, data: { isVisible: false } });
    return { message: 'Review hidden' };
  }
}
