export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function estimateReadingTime(content: string, wordsPerMinute = 220): number {
  const words = content
    .replace(/[`*_>#[\](){}/\\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length

  if (!words) return 1
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}
