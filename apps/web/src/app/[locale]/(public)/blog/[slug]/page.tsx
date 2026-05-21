'use client';
import type { JSX } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BlogPost {
  id: string; title: string; slug: string; content: string;
  coverImageUrl?: string; publishedAt?: string; readingTimeMinutes?: number;
  author?: { firstName: string; lastName: string; avatarUrl?: string; };
  tags?: string[];
}

export default function BlogPostPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const locale = useLocale();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: () => apiClient.get<BlogPost>(`/blog/${slug}`),
    enabled: !!slug,
  });

  const post = data?.data;

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
    </div>
  );

  if (isError || !post) return (
    <div className="py-20 text-center">
      <p className="text-gray-500">Post not found.</p>
      <Link href={`/${locale}/blog`}><Button variant="outline" className="mt-4">Back to blog</Button></Link>
    </div>
  );

  return (
    <main className="min-h-screen bg-white">
      {post.coverImageUrl && (
        <div className="relative h-72 w-full overflow-hidden bg-sky-100 sm:h-96">
          <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Back */}
        <Link href={`/${locale}/blog`} className="mb-6 inline-flex items-center gap-1 text-sm text-sky-600 hover:underline">
          ← Back to blog
        </Link>

        {/* Tags */}
        {post.tags && <div className="mb-4 flex flex-wrap gap-1.5">{post.tags.map((t) => <Badge key={t} color="sky">{t}</Badge>)}</div>}

        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">{post.title}</h1>

        {/* Author + meta */}
        <div className="mt-4 flex items-center gap-3">
          {post.author?.avatarUrl ? (
            <Image src={post.author.avatarUrl} alt={post.author.firstName} width={36} height={36} className="rounded-full" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-600">
              {post.author?.firstName?.[0] ?? 'D'}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {post.author ? `Dr. ${post.author.firstName} ${post.author.lastName}` : 'DocNear'}
            </p>
            <p className="text-xs text-gray-400">
              {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ''}
            </p>
          </div>
        </div>

        {/* Content */}
        <article
          className="prose prose-gray mt-8 max-w-none prose-headings:font-bold prose-a:text-sky-600 prose-img:rounded-2xl"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl bg-sky-50 p-6 text-center">
          <p className="font-semibold text-gray-900">Ready to consult a doctor?</p>
          <Link href={`/${locale}/find-doctors`}>
            <Button className="mt-3">Find a Doctor</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
