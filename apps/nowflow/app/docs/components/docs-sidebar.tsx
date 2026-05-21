'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import type { DocsNavGroup } from '../docs-nav'

interface DocsSidebarProps {
  nav: DocsNavGroup[]
}

const isActiveLink = (pathname: string, href: string) => {
  if (href === '/docs') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function DocsSidebar({ nav }: DocsSidebarProps) {
  const pathname = usePathname()
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()
  const totalCount = useMemo(
    () => nav.reduce((sum, section) => sum + section.items.length, 0),
    [nav]
  )
  const filteredNav = useMemo(() => {
    if (!normalizedQuery) return nav

    return nav
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((section) => section.items.length > 0)
  }, [nav, normalizedQuery])
  const visibleCount = useMemo(
    () => filteredNav.reduce((sum, section) => sum + section.items.length, 0),
    [filteredNav]
  )

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-logo text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-white/22">
            Docs
          </p>
          <p className="mt-1 text-[12px] text-zinc-500 dark:text-white/38 font-logo">
            {normalizedQuery ? `${visibleCount} of ${totalCount}` : `${totalCount} pages`}
          </p>
        </div>
        <span className="silver-glass-chip rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-white/38 font-logo">
          Explore
        </span>
      </div>

      <div className="silver-glass-pane relative mb-6 rounded-2xl">
        <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-white/22" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a page..."
          className="w-full rounded-2xl bg-transparent py-3 pl-10 pr-9 text-[13px] font-logo text-zinc-700 outline-none placeholder:text-zinc-400 dark:text-white/70 dark:placeholder:text-white/22"
        />
        {normalizedQuery && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition-colors hover:text-zinc-600 dark:text-white/22 dark:hover:text-white/42"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <nav className="space-y-4" aria-label="Docs navigation">
        {filteredNav.length === 0 && (
          <p className="text-[13px] text-zinc-500 dark:text-white/42 font-logo">
            No matching pages.
          </p>
        )}
        {filteredNav.map((section) => {
          return (
            <details key={section.title} open className="silver-glass-pane rounded-2xl p-3.5 group">
              <summary className="mb-2 flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-logo text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 dark:text-white/28">
                  {section.title}
                </span>
                <span className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] text-zinc-400 dark:bg-white/[0.04] dark:text-white/22 font-logo">
                  {section.items.length}
                </span>
              </summary>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = isActiveLink(pathname, item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-xl px-3 py-2 text-[13px] font-logo transition-all duration-200 ${
                          isActive
                            ? 'silver-glass-chip text-[#4A7A68] dark:text-[#9bc8b3] shadow-[0_10px_20px_rgba(24,24,27,0.06)]'
                            : 'text-zinc-500 hover:bg-white/40 hover:text-zinc-800 dark:text-white/42 dark:hover:bg-white/[0.04] dark:hover:text-white/72'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </nav>
    </div>
  )
}
