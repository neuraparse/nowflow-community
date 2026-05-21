import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { blogTag } from '@/db/schema'
import { slugify } from './utils'

export type TagInput = {
  name: string
  slug: string
}

export function normalizeTags(tags?: string[]): TagInput[] {
  if (!tags?.length) return []
  const map = new Map<string, TagInput>()
  for (const raw of tags) {
    const name = raw.trim()
    if (!name) continue
    const slug = slugify(name)
    if (!slug) continue
    if (!map.has(slug)) {
      map.set(slug, { name, slug })
    }
  }
  return Array.from(map.values())
}

export async function resolveTagIds(tags: TagInput[]): Promise<string[]> {
  if (!tags.length) return []

  const slugs = tags.map((tag) => tag.slug)
  const existing = await db
    .select({ id: blogTag.id, slug: blogTag.slug })
    .from(blogTag)
    .where(inArray(blogTag.slug, slugs))

  const existingMap = new Map(
    existing.map((tag: { id: string; slug: string }) => [tag.slug, tag.id])
  )
  const missing = tags.filter((tag) => !existingMap.has(tag.slug))

  if (missing.length) {
    const now = new Date()
    const newTags = missing.map((tag) => ({
      id: crypto.randomUUID(),
      name: tag.name,
      slug: tag.slug,
      createdAt: now,
      updatedAt: now,
    }))
    await db.insert(blogTag).values(newTags)
    for (const tag of newTags) {
      existingMap.set(tag.slug, tag.id)
    }
  }

  return slugs.map((slug) => existingMap.get(slug)).filter(Boolean) as string[]
}
