import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { ListPostsDto } from './dto/list-posts.dto';
import { CreatePostDto, UpdatePostDto } from './dto/manage-post.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // ── Public ─────────────────────────────────────────────────────────────────

  /** GET /v1/blog/categories */
  @Public()
  @Get('categories')
  listCategories() {
    return this.blogService.listCategories();
  }

  /** GET /v1/blog/posts */
  @Public()
  @Get('posts')
  listPosts(@Query() dto: ListPostsDto) {
    return this.blogService.listPosts(dto);
  }

  /** GET /v1/blog/posts/:slug */
  @Public()
  @Get('posts/:slug')
  getPost(@Param('slug') slug: string) {
    return this.blogService.getPostBySlug(slug);
  }

  // ── Admin CRUD ──────────────────────────────────────────────────────────────

  /** POST /v1/blog/posts */
  @Post('posts')
  createPost(@CurrentUser() user: RequestUser, @Body() dto: CreatePostDto) {
    return this.blogService.createPost(user.id, user.role, dto);
  }

  /** PATCH /v1/blog/posts/:id */
  @Patch('posts/:id')
  updatePost(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.blogService.updatePost(id, user.role, dto);
  }

  /** DELETE /v1/blog/posts/:id */
  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  deletePost(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.blogService.deletePost(id, user.role);
  }
}
