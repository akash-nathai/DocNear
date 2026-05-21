import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BlogStatus, Role } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { ListPostsDto } from './dto/list-posts.dto';
import { CreatePostDto, UpdatePostDto } from './dto/manage-post.dto';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async listPosts(dto: ListPostsDto) {
    const { page, limit, categorySlug, specialitySlug, tag, status } = dto;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      status: status ?? BlogStatus.PUBLISHED,
    };

    if (categorySlug) {
      const cat = await this.prisma.blogCategory.findUnique({ where: { slug: categorySlug } });
      if (cat) where['categoryId'] = cat.id;
    }
    if (specialitySlug) {
      const spec = await this.prisma.speciality.findUnique({ where: { slug: specialitySlug } });
      if (spec) where['specialityId'] = spec.id;
    }
    if (tag) {
      where['tags'] = { has: tag };
    }

    const [posts, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        include: {
          author: { select: { firstName: true, lastName: true, avatarUrl: true } },
          category: { select: { name: true, slug: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return {
      data: posts.map(p => this.formatCard(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPostBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: { select: { firstName: true, lastName: true, avatarUrl: true } },
        category: { select: { name: true, slug: true } },
        speciality: { select: { name: true, slug: true } },
      },
    });
    if (!post || post.status !== BlogStatus.PUBLISHED) {
      throw new NotFoundException('Blog post not found');
    }
    return post;
  }

  async listCategories() {
    return this.prisma.blogCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  async createPost(authorId: string, role: string, dto: CreatePostDto) {
    if (role !== Role.SUPER_ADMIN) throw new ForbiddenException('Access denied');

    const existing = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('A post with this slug already exists');

    return this.prisma.blogPost.create({
      data: {
        id: randomUUID(),
        title: dto.title,
        slug: dto.slug,
        excerpt: dto.excerpt ?? null,
        contentMarkdown: dto.contentMarkdown,
        coverImageUrl: dto.coverImageUrl ?? null,
        authorId,
        categoryId: dto.categoryId ?? null,
        specialityId: dto.specialityId ?? null,
        tags: dto.tags ?? [],
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        estimatedReadMinutes: dto.estimatedReadMinutes ?? 3,
        status: dto.status ?? BlogStatus.DRAFT,
        publishedAt: dto.status === BlogStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async updatePost(postId: string, role: string, dto: UpdatePostDto) {
    if (role !== Role.SUPER_ADMIN) throw new ForbiddenException('Access denied');

    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    const data: Record<string, unknown> = { ...dto };
    if (dto.status === BlogStatus.PUBLISHED && !post.publishedAt) {
      data['publishedAt'] = new Date();
    }

    return this.prisma.blogPost.update({ where: { id: postId }, data });
  }

  async deletePost(postId: string, role: string) {
    if (role !== Role.SUPER_ADMIN) throw new ForbiddenException('Access denied');
    const post = await this.prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    await this.prisma.blogPost.delete({ where: { id: postId } });
    return { message: 'Post deleted' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatCard(post: any) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImageUrl: post.coverImageUrl,
      estimatedReadMinutes: post.estimatedReadMinutes,
      tags: post.tags,
      publishedAt: post.publishedAt,
      author: post.author
        ? { name: `${post.author.firstName} ${post.author.lastName}`, avatarUrl: post.author.avatarUrl }
        : null,
      category: post.category ?? null,
    };
  }
}
