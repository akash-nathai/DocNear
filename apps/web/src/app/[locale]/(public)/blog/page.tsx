'use client';
import type { JSX } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';

interface BlogPost {
  id: string; title: string; slug: string; excerpt?: string;
  coverImageUrl?: string; publishedAt?: string; readingTimeMinutes?: number;
  author?: { firstName: string; lastName: string; };
  tags?: string[];
}
interface BlogResponse { posts: BlogPost[]; total: number; }

function fmt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogPage(): JSX.Element {
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: () => apiClient.get<BlogResponse>('/blog?limit=12&page=1&status=PUBLISHED'),
    staleTime: 60_000,
  });

  const posts = data?.data.posts ?? [];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-sky-600 to-sky-400 py-14 px-4 text-center text-white">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Health Blog</h1>
        <p className="mt-2 text-sky-100">Expert advice from our doctors</p>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({length: 6}).map((_,i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-gray-200" />)}
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
            <p className="text-gray-400">No blog posts published yet.</p>
          </div>
        )}

        {!isLoading && posts.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} href={`/${locale}/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition">
                <div className="relative h-44 w-full overflow-hidden bg-sky-100">
                  {post.coverImageUrl ? (
                    <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-sky-300">📰</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {post.tags && post.tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {post.tags.slice(0, 3).map((tag) => <Badge key={tag} color="sky">{tag}</Badge>)}
                    </div>
                  )}
                  <h2 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:text-sky-600 transition">{post.title}</h2>
                  {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-gray-500">{post.excerpt}</p>}
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-400">
                    <span>{post.author ? `Dr. ${post.author.firstName} ${post.author.lastName}` : 'DocNear'}</span>
                    <span>{fmt(post.publishedAt)}{post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ''}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
