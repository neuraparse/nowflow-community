import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, isNotNull, lte } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { db } from '@/db'
import { blogCategory, blogPost, blogPostTag, blogTag } from '@/db/schema'
import NavWrapper from '../../components/nav-wrapper'
import Footer from '../../components/sections/footer'

export const dynamic = 'force-dynamic'

const CONTENT_COMPONENTS = {
  h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-12 mb-5 font-heading text-3xl font-semibold tracking-[-0.03em] text-zinc-800 dark:text-white md:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-10 mb-4 font-heading text-2xl font-semibold tracking-[-0.03em] text-zinc-800 dark:text-white">
      {children}
    </h2>
  ),
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-8 mb-3 font-heading text-xl font-semibold tracking-[-0.025em] text-zinc-800 dark:text-white">
      {children}
    </h3>
  ),
  p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-5 font-body text-[15px] leading-[1.8] tracking-[-0.012em] text-zinc-500 dark:text-white/42">
      {children}
    </p>
  ),
  ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-5 list-disc space-y-1 pl-6 font-body text-[15px] leading-[1.8] tracking-[-0.012em] text-zinc-500 dark:text-white/42">
      {children}
    </ul>
  ),
  ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-5 list-decimal space-y-1 pl-6 font-body text-[15px] leading-[1.8] tracking-[-0.012em] text-zinc-500 dark:text-white/42">
      {children}
    </ol>
  ),
  blockquote: ({ children }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="silver-glass-pane signal-accent-frame my-6 rounded-[16px] border-l-2 border-[#6b5df6]/25 px-5 py-4 font-serif text-[15px] italic leading-[1.8] text-zinc-600 dark:border-[#9ea6ff]/18 dark:text-white/36">
      {children}
    </blockquote>
  ),
  code: ({
    inline,
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { inline?: boolean; className?: string }) =>
    inline ? (
      <code
        className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-700 dark:bg-white/[0.06] dark:text-white/60"
        {...props}
      >
        {children}
      </code>
    ) : (
      <pre className="silver-glass-pane signal-accent-frame my-6 overflow-x-auto rounded-[16px] p-5 text-[13px]">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    ),
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="text-[#6b5df6] underline decoration-[#6b5df6]/25 underline-offset-4 transition-colors duration-200 hover:decoration-[#6b5df6]/50 dark:text-[#9ea6ff] dark:decoration-[#9ea6ff]/20 dark:hover:decoration-[#9ea6ff]/50"
      {...props}
    >
      {children}
    </a>
  ),
  hr: () => <div className="my-10 h-px bg-black/[0.05] dark:bg-white/[0.06]" />,
}

function formatDate(value: Date | null) {
  if (!value) return ''
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function getPost(slug: string) {
  const now = new Date()
  const [post] = await db
    .select({
      id: blogPost.id,
      title: blogPost.title,
      slug: blogPost.slug,
      excerpt: blogPost.excerpt,
      content: blogPost.content,
      coverImage: blogPost.coverImage,
      coverImageAlt: blogPost.coverImageAlt,
      publishedAt: blogPost.publishedAt,
      readingTime: blogPost.readingTime,
      seoTitle: blogPost.seoTitle,
      seoDescription: blogPost.seoDescription,
      canonicalUrl: blogPost.canonicalUrl,
      ogImage: blogPost.ogImage,
      categoryName: blogCategory.name,
    })
    .from(blogPost)
    .leftJoin(blogCategory, eq(blogPost.categoryId, blogCategory.id))
    .where(
      and(
        eq(blogPost.slug, slug),
        eq(blogPost.status, 'published'),
        isNotNull(blogPost.publishedAt),
        lte(blogPost.publishedAt, now)
      )
    )

  if (!post) return null

  const tags = await db
    .select({
      id: blogTag.id,
      name: blogTag.name,
      slug: blogTag.slug,
    })
    .from(blogPostTag)
    .innerJoin(blogTag, eq(blogPostTag.tagId, blogTag.id))
    .where(eq(blogPostTag.postId, post.id))

  return { ...post, tags }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) {
    return {
      title: 'Blog | NowFlow',
      description: 'NowFlow blog post.',
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || 'NowFlow blog post.'
  const image = post.ogImage || post.coverImage || `${baseUrl}/opengraph-image`
  const url = post.canonicalUrl || `${baseUrl}/blog/${post.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return notFound()

  return (
    <main className="dark relative min-h-screen overflow-hidden bg-[#f4f5f7] dark:bg-[#0A0A0A] odyssey-landing community-ui-framework community-ui-landing font-body">
      <div aria-hidden="true" className="community-ui-scene-backdrop" />
      <NavWrapper />

      <div className="relative z-10">
        <article className="mx-auto max-w-[1100px] px-4 pb-24 pt-30 sm:px-6 sm:pb-32 sm:pt-36 lg:px-8 lg:pt-40">
          <div className="community-ui-framework-shell silver-glass-panel signal-accent-frame rounded-[18px] p-5 sm:p-8 lg:p-10">
            <Link
              href="/blog"
              className="signal-accent-chip mb-8 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 font-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-colors duration-200 hover:text-[#6b5df6] dark:text-white/34 dark:hover:text-[#9ea6ff]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Blog
            </Link>

            <header className="mb-8 sm:mb-10">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {post.categoryName ? (
                  <span className="signal-accent-chip rounded-[10px] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b5df6] dark:text-[#9ea6ff] font-tech">
                    {post.categoryName}
                  </span>
                ) : null}
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-[10px] bg-white/45 px-2.5 py-1 text-[10px] tracking-[-0.01em] text-zinc-500 dark:bg-white/[0.04] dark:text-white/30 font-body"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              <h1 className="odyssey-display-title max-w-4xl text-[3rem] text-zinc-800 dark:text-white sm:text-[3.8rem] lg:text-[5rem]">
                {post.title}
              </h1>

              {post.excerpt ? (
                <p className="odyssey-section-copy mt-5 max-w-3xl text-base sm:text-lg">
                  {post.excerpt}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500 dark:text-white/32 font-body">
                <span>{formatDate(post.publishedAt)}</span>
                <span className="text-zinc-300 dark:text-white/14">&middot;</span>
                <span>{post.readingTime} min read</span>
                <span className="text-zinc-300 dark:text-white/14">&middot;</span>
                <span>NowFlow Journal</span>
              </div>
            </header>

            {post.coverImage ? (
              <div className="relative mb-10 overflow-hidden rounded-[30px] border border-white/60 dark:border-white/[0.08] shadow-[0_26px_60px_rgba(24,24,27,0.10)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.26)]">
                <Image
                  src={post.coverImage}
                  alt={post.coverImageAlt || post.title}
                  width={1200}
                  height={520}
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="max-h-[520px] w-full object-cover"
                  priority
                  unoptimized
                />
              </div>
            ) : null}

            <div className="mb-8 h-px bg-black/[0.05] dark:bg-white/[0.06]" />

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-10">
              <div className="min-w-0">
                <div className="prose-reset max-w-[720px]">
                  <ReactMarkdown components={CONTENT_COMPONENTS}>{post.content}</ReactMarkdown>
                </div>
              </div>

              <aside className="hidden lg:block">
                <div className="silver-glass-pane signal-accent-frame sticky top-32 rounded-[14px] p-5">
                  <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/28">
                    Article Notes
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="border-b border-black/[0.05] pb-3 dark:border-white/[0.06]">
                      <p className="font-tech text-[11px] uppercase tracking-[0.12em] text-zinc-400 dark:text-white/28">
                        Published
                      </p>
                      <p className="mt-1 font-body text-[13px] tracking-[-0.01em] text-zinc-700 dark:text-white/72">
                        {formatDate(post.publishedAt)}
                      </p>
                    </div>
                    <div className="border-b border-black/[0.05] pb-3 dark:border-white/[0.06]">
                      <p className="font-tech text-[11px] uppercase tracking-[0.12em] text-zinc-400 dark:text-white/28">
                        Reading Time
                      </p>
                      <p className="mt-1 font-body text-[13px] tracking-[-0.01em] text-zinc-700 dark:text-white/72">
                        {post.readingTime} min
                      </p>
                    </div>
                    <div>
                      <p className="font-tech text-[11px] uppercase tracking-[0.12em] text-zinc-400 dark:text-white/28">
                        Category
                      </p>
                      <p className="mt-1 font-body text-[13px] tracking-[-0.01em] text-zinc-700 dark:text-white/72">
                        {post.categoryName || 'Journal'}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-12 h-px bg-black/[0.05] dark:bg-white/[0.06]" />

            <div className="mt-8">
              <Link
                href="/blog"
                className="silver-glass-button inline-flex items-center gap-2 rounded-[10px] px-4 py-2 font-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:text-white/72"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Posts
              </Link>
            </div>
          </div>
        </article>
      </div>

      <Footer />
    </main>
  )
}
