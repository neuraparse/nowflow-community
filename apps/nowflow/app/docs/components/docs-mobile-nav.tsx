'use client'

import { useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { DocsNavGroup } from '../docs-nav'

interface DocsMobileNavProps {
  nav: DocsNavGroup[]
}

const findActiveHref = (pathname: string, nav: DocsNavGroup[]) => {
  let best = ''
  nav.forEach((section) => {
    section.items.forEach((item) => {
      const matches =
        item.href === '/docs'
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
      if (matches && item.href.length > best.length) {
        best = item.href
      }
    })
  })
  return best
}

export default function DocsMobileNav({ nav }: DocsMobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const activeHref = useMemo(() => findActiveHref(pathname, nav), [pathname, nav])

  return (
    <div className="lg:hidden">
      <div className="silver-glass-pane rounded-[24px] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-logo text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-white/28">
            Navigation
          </p>
          <span className="silver-glass-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/34 font-logo">
            Mobile Docs
          </span>
        </div>
        <select
          value={activeHref || ''}
          onChange={(event) => {
            const nextHref = event.target.value
            if (nextHref) {
              router.push(nextHref)
            }
          }}
          aria-label="Docs navigation"
          className="silver-glass-chip w-full rounded-2xl px-4 py-3 text-[13px] font-logo font-medium text-zinc-700 outline-none dark:text-white/70"
        >
          <option value="">Select a page</option>
          {nav.map((section) => (
            <optgroup key={section.title} label={section.title}>
              {section.items.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}
