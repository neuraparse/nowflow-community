'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { NowFlowWordmark } from '@/components/branding/nowflow-brand'
import { NowFlowLogoMark } from '@/components/branding/nowflow-logo-mark'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/docs', label: 'Docs' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

const subscribeToClientMount = () => () => {}
const getClientMountedSnapshot = () => true
const getServerMountedSnapshot = () => false

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://')
}

interface NavClientProps {
  currentPath?: string
}

export default function NavClient({ currentPath }: NavClientProps) {
  const logoRef = useRef<SVGSVGElement | null>(null)
  const hasMounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  )
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  return (
    <nav
      className="community-ui-nav-region absolute top-0 left-0 right-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+0.9rem)] pb-3 sm:px-6 sm:pt-6 sm:pb-4"
      aria-label="Main navigation"
    >
      <div className="community-ui-nav-shell silver-glass-pane relative mx-auto max-w-[76rem] overflow-hidden rounded-[16px] border border-black/[0.06] bg-[rgba(244,246,248,0.92)] px-2.5 py-2.5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:px-3 sm:py-3 dark:border-white/[0.08] dark:bg-[rgba(13,12,10,0.9)] dark:shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.46), transparent)',
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 px-1.5 py-0.5">
            <button
              type="button"
              onClick={() => {
                const svgElement = logoRef.current
                if (!svgElement) return
                const svgMarkup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svgElement)}`
                const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'nowflow-logo.svg'
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="community-ui-nav-mark group relative flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(236,239,243,0.2))] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] transition-transform duration-300 hover:scale-[1.02] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              title="Click to download logo"
              aria-label="Download NowFlow logo"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[1px] rounded-[9px] opacity-30 transition-opacity duration-500 group-hover:opacity-44"
                style={{
                  background:
                    'conic-gradient(from var(--border-angle, 0deg), transparent 0%, var(--ody-signal-coral, #ff7a59) 16%, var(--ody-signal-violet, #802fff) 36%, transparent 52%, var(--ody-signal-amber, #ff972f) 72%, var(--ody-signal-cyan, #00a1e0) 88%, transparent 100%)',
                  animation: 'border-spin 6s linear infinite',
                }}
              />
              <NowFlowLogoMark
                ref={logoRef}
                className="relative z-10 h-6 w-6 sm:h-6.5 sm:w-6.5"
                idPrefix="nav-nowflow"
              />
            </button>
            <Link href="/" className="min-w-0" aria-label="NowFlow home page">
              <div className="flex min-w-0 flex-col">
                <NowFlowWordmark className="truncate text-[15px] sm:text-[16px]" size="sm" />
                <span className="mt-1 hidden items-center gap-1.5 font-tech text-[8px] uppercase tracking-[0.14em] text-zinc-400 md:inline-flex dark:text-white/26">
                  <span className="h-1.5 w-1.5 rounded-[2px] bg-[#dcfd38]" />
                  Agentic Application Layer
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="community-ui-nav-links hidden items-center gap-1 rounded-[12px] bg-black/[0.025] p-1 md:flex dark:bg-white/[0.02]">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={isExternalHref(link.href) ? '_blank' : undefined}
                  rel={isExternalHref(link.href) ? 'noopener noreferrer' : undefined}
                  className={`community-ui-nav-link inline-flex h-8 items-center rounded-[8px] px-3.5 text-[10px] font-semibold font-tech uppercase tracking-[0.14em] transition-all duration-200 ${
                    currentPath === link.href
                      ? 'bg-white/[0.58] text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:bg-white/[0.08] dark:text-white'
                      : 'text-zinc-500 hover:bg-white/[0.16] hover:text-zinc-800 dark:text-white/[0.5] dark:hover:bg-white/[0.04] dark:hover:text-white/80'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {currentPath === link.href && (
                      <span className="h-1.5 w-1.5 rounded-[2px] bg-[#dcfd38]" />
                    )}
                    {link.label}
                  </span>
                </Link>
              ))}

              <div className="mx-1 h-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />

              <Link
                href="/login"
                className="community-ui-nav-signin ml-1 inline-flex h-8 items-center rounded-[8px] bg-[#17181b] px-3.5 text-[10px] font-semibold font-tech uppercase tracking-[0.14em] text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#1c1d21] dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
                aria-label="Sign in to NowFlow"
              >
                Sign In
              </Link>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              {hasMounted ? (
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen} modal={false}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="community-ui-nav-icon-button flex h-8 w-8 items-center justify-center rounded-[8px] bg-black/[0.03] text-zinc-500 transition-colors hover:bg-black/[0.06] hover:text-zinc-700 dark:bg-white/[0.02] dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white/60"
                      aria-label="Open navigation menu"
                      aria-expanded={isSheetOpen}
                    >
                      <Menu className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    className="community-ui-nav-drawer silver-glass-pane w-[min(18rem,90vw)] overflow-hidden border-black/[0.06] bg-[rgba(244,246,248,0.96)] p-5 dark:border-white/[0.08] dark:bg-[rgba(13,12,10,0.96)]"
                  >
                    <SheetHeader>
                      <SheetTitle className="font-heading text-left">Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 flex flex-col gap-1.5">
                      {navLinks.map((link) => (
                        <Link
                          key={link.label}
                          href={link.href}
                          target={isExternalHref(link.href) ? '_blank' : undefined}
                          rel={isExternalHref(link.href) ? 'noopener noreferrer' : undefined}
                          className={`community-ui-nav-drawer-link rounded-[8px] px-3 py-2.5 text-[10px] font-semibold font-tech uppercase tracking-[0.14em] transition-colors ${
                            currentPath === link.href
                              ? 'bg-white/[0.34] text-zinc-800 dark:bg-white/[0.08] dark:text-white'
                              : 'text-zinc-500 hover:text-zinc-800 dark:text-white/40 dark:hover:text-white/70'
                          }`}
                          onClick={() => setIsSheetOpen(false)}
                        >
                          <span className="flex items-center gap-2">
                            {currentPath === link.href && (
                              <span className="h-1.5 w-1.5 rounded-[2px] bg-[#dcfd38]" />
                            )}
                            {link.label}
                          </span>
                        </Link>
                      ))}
                      <div className="my-3 h-px bg-black/[0.05] dark:bg-white/[0.05]" />
                      <Link
                        href="/login"
                        className="community-ui-nav-drawer-signin rounded-[8px] bg-[#17181b] py-2.5 text-center text-[10px] font-semibold font-tech uppercase tracking-[0.14em] text-white transition-colors dark:bg-white/[0.06] dark:text-white"
                        onClick={() => setIsSheetOpen(false)}
                      >
                        Sign In
                      </Link>
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <div
                  className="community-ui-nav-icon-button flex h-8 w-8 items-center justify-center rounded-[8px] bg-black/[0.03] text-zinc-500 dark:bg-white/[0.02] dark:text-white/40"
                  aria-hidden="true"
                >
                  <Menu className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
