import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { and, desc, eq, inArray, isNotNull, lte } from 'drizzle-orm'
import { ArrowRight } from 'lucide-react'
import { db } from '@/db'
import { blogCategory, blogPost, blogPostTag, blogTag } from '@/db/schema'
import NavWrapper from '../components/nav-wrapper'
import Footer from '../components/sections/footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blog | NowFlow Community',
  description: 'Insights, product updates, and deep dives on workflow automation and AI.',
}

const editorialSignals = [
  { label: 'Product notes', value: 'Live' },
  { label: 'Deep dives', value: 'Weekly' },
  { label: 'Workflow ideas', value: 'Curated' },
]

function formatDate(value: Date | null) {
  if (!value) return ''
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function BlogLandingPage() {
  const now = new Date()
  const posts = await db
    .select({
      id: blogPost.id,
      title: blogPost.title,
      slug: blogPost.slug,
      excerpt: blogPost.excerpt,
      coverImage: blogPost.coverImage,
      coverImageAlt: blogPost.coverImageAlt,
      publishedAt: blogPost.publishedAt,
      readingTime: blogPost.readingTime,
      isFeatured: blogPost.isFeatured,
      categoryName: blogCategory.name,
    })
    .from(blogPost)
    .leftJoin(blogCategory, eq(blogPost.categoryId, blogCategory.id))
    .where(
      and(
        eq(blogPost.status, 'published'),
        isNotNull(blogPost.publishedAt),
        lte(blogPost.publishedAt, now)
      )
    )
    .orderBy(desc(blogPost.publishedAt))

  const postIds = posts.map((post) => post.id)
  const tagRows = postIds.length
    ? await db
        .select({
          postId: blogPostTag.postId,
          id: blogTag.id,
          name: blogTag.name,
          slug: blogTag.slug,
        })
        .from(blogPostTag)
        .innerJoin(blogTag, eq(blogPostTag.tagId, blogTag.id))
        .where(inArray(blogPostTag.postId, postIds))
    : []

  const tagsByPost = new Map<string, Array<{ id: string; name: string; slug: string }>>()
  for (const tag of tagRows) {
    const current = tagsByPost.get(tag.postId) || []
    current.push({ id: tag.id, name: tag.name, slug: tag.slug })
    tagsByPost.set(tag.postId, current)
  }

  const featured = posts.find((post) => post.isFeatured) || posts[0]
  const featuredId = featured?.id
  const rest = posts.filter((post) => post.id !== featuredId)

  return (
    <main className="dark relative min-h-screen overflow-hidden bg-[#f4f5f7] dark:bg-[#0A0A0A] odyssey-landing community-ui-framework community-ui-landing font-body">
      <div aria-hidden="true" className="community-ui-scene-backdrop" />
      <NavWrapper />

      <div className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-30 sm:px-6 sm:pb-12 sm:pt-36 lg:px-8 lg:pt-40">
          <div className="community-ui-framework-shell silver-glass-panel signal-accent-frame rounded-[18px] p-5 sm:p-8 lg:p-10">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_280px] lg:items-end">
              <div className="max-w-3xl">
                <div className="signal-accent-chip mb-5 inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-[2px]"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--ody-signal-coral, #ff7a59) 0%, var(--ody-signal-violet, #802fff) 52%, var(--ody-signal-cyan, #00a1e0) 100%)',
                    }}
                  />
                  <span className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-white/40">
                    Editorial Feed
                  </span>
                </div>
                <h1 className="odyssey-display-title text-[3rem] text-zinc-800 dark:text-white sm:text-[3.8rem] md:text-[4.65rem] lg:text-[4.2rem]">
                  Product thinking for{' '}
                  <span className="odyssey-display-accent bg-[var(--ody-signal-line-soft)] bg-clip-text text-transparent">
                    agentic workflows
                  </span>
                </h1>
                <p className="odyssey-section-copy mt-5 max-w-2xl text-base sm:text-lg">
                  Deeper notes from the NowFlow team on shipping automation, product surfaces,
                  deployment patterns, and the decisions behind modern workflow systems.
                </p>
              </div>

              <div className="community-ui-framework-pane silver-glass-pane rounded-[14px] p-4 sm:p-5">
                <p className="font-tech text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/28">
                  Reading Rhythm
                </p>
                <div className="mt-4 space-y-3">
                  {editorialSignals.map((item) => (
                    <div
                      key={item.label}
                      className="community-ui-framework-data-row dark:border-white/[0.06]"
                    >
                      <span className="community-ui-framework-meta-label">{item.label}</span>
                      <span className="community-ui-framework-meta-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {featured ? (
          <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 sm:pb-12 lg:px-8">
            <Link href={`/blog/${featured.slug}`} className="group block">
              <div className="community-ui-framework-shell silver-glass-panel overflow-hidden rounded-[18px]">
                <div className="grid lg:grid-cols-[1.2fr_0.92fr]">
                  <div className="relative min-h-[300px] overflow-hidden sm:min-h-[380px] lg:min-h-full">
                    {featured.coverImage ? (
                      <Image
                        src={featured.coverImage}
                        alt={featured.coverImageAlt || featured.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 55vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        priority
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-zinc-100 via-white to-zinc-200 dark:from-white/[0.03] dark:via-white/[0.02] dark:to-white/[0.08]" />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/12 via-transparent to-transparent dark:from-black/25" />
                  </div>

                  <div className="flex flex-col gap-5 p-5 sm:p-7 lg:p-10">
                    <div className="flex flex-wrap items-center gap-2">
                      {featured.categoryName ? (
                        <span className="silver-glass-chip rounded-[10px] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b5df6] dark:text-[#9ea6ff] font-tech">
                          {featured.categoryName}
                        </span>
                      ) : null}
                      <span className="silver-glass-chip rounded-[10px] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-white/34 font-tech">
                        Featured
                      </span>
                    </div>

                    <div>
                      <h2 className="font-heading text-[2rem] font-medium leading-[1.08] tracking-[-0.035em] text-zinc-800 transition-colors duration-200 group-hover:text-[#6b5df6] dark:text-white dark:group-hover:text-[#9ea6ff] sm:text-[2.3rem]">
                        {featured.title}
                      </h2>
                      {featured.excerpt ? (
                        <p className="mt-4 max-w-xl text-[14px] leading-relaxed tracking-[-0.012em] text-zinc-500 dark:text-white/40 font-body sm:text-[15px]">
                          {featured.excerpt}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-center gap-3 pt-2 text-[12px] text-zinc-500 dark:text-white/32 font-body">
                      <span>{formatDate(featured.publishedAt)}</span>
                      <span className="text-zinc-300 dark:text-white/14">&middot;</span>
                      <span>{featured.readingTime} min read</span>
                      <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#6b5df6] dark:text-white/28 dark:group-hover:text-[#9ea6ff]" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
          {rest.length === 0 && !featured ? (
            <div className="silver-glass-panel rounded-[28px] p-12 text-center">
              <p className="font-body text-[14px] tracking-[-0.012em] text-zinc-500 dark:text-white/34">
                No published posts yet.
              </p>
            </div>
          ) : rest.length > 0 ? (
            <>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="font-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-white/28">
                    Latest Stories
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-medium tracking-[-0.03em] text-zinc-800 dark:text-white">
                    More from the journal
                  </h2>
                </div>
                <div className="hidden md:flex items-center gap-2 text-[12px] text-zinc-500 dark:text-white/34 font-body">
                  <span>{rest.length}</span>
                  <span>published entries</span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rest.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="silver-glass-panel group flex h-full flex-col overflow-hidden rounded-[30px] transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <div className="relative h-52 overflow-hidden">
                      {post.coverImage ? (
                        <Image
                          src={post.coverImage}
                          alt={post.coverImageAlt || post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-zinc-100 via-white to-zinc-200 dark:from-white/[0.03] dark:via-white/[0.02] dark:to-white/[0.08]" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.categoryName ? (
                          <span className="silver-glass-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4A7A68] dark:text-[#9bc8b3] font-tech">
                            {post.categoryName}
                          </span>
                        ) : null}
                        {(tagsByPost.get(post.id) || []).slice(0, 1).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-white/45 px-2.5 py-1 text-[10px] tracking-[-0.01em] text-zinc-500 dark:bg-white/[0.04] dark:text-white/30 font-body"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>

                      <h3 className="font-heading text-[18px] font-semibold leading-snug tracking-[-0.025em] text-zinc-800 transition-colors duration-200 group-hover:text-[#4A7A68] dark:text-white dark:group-hover:text-[#9bc8b3] line-clamp-2">
                        {post.title}
                      </h3>

                      {post.excerpt ? (
                        <p className="text-[13px] leading-relaxed tracking-[-0.012em] text-zinc-500 dark:text-white/36 font-body line-clamp-3">
                          {post.excerpt}
                        </p>
                      ) : null}

                      <div className="mt-auto flex items-center gap-2 pt-2 text-[11px] text-zinc-500 dark:text-white/30 font-body">
                        <span>{formatDate(post.publishedAt)}</span>
                        <span className="text-zinc-300 dark:text-white/14">&middot;</span>
                        <span>{post.readingTime} min</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <Footer />
    </main>
  )
}
