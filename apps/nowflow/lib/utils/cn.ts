/**
 * Tailwind class-name merge helper.
 *
 * Extracted from `lib/utils.ts`. Combines `clsx` (conditional class composition)
 * with `tailwind-merge` (de-duplicates conflicting Tailwind utility classes,
 * keeping the rightmost). Callers should import from `@/lib/utils` (the
 * canonical entry — re-exports this symbol).
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
