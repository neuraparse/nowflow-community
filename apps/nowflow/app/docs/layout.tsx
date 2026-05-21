import type { ReactNode } from 'react'
import NavWrapper from '../(landing)/components/nav-wrapper'
import Footer from '../(landing)/components/sections/footer'
import DocsMobileNav from './components/docs-mobile-nav'
import DocsSidebar from './components/docs-sidebar'
import { docsNav } from './docs-nav'

interface DocsLayoutProps {
  children: ReactNode
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <main
      id="main-content"
      className="docs-shell relative min-h-screen overflow-hidden bg-background font-sans text-foreground"
    >
      <NavWrapper />

      <section className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pb-24 pt-30 sm:px-6 sm:pb-28 sm:pt-34 lg:px-8 lg:pt-38">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside className="hidden lg:block">
            <div className="sticky top-30 rounded-lg border bg-card p-4 shadow-sm">
              <DocsSidebar nav={docsNav} />
            </div>
          </aside>

          <div className="min-w-0 space-y-4 sm:space-y-5">
            <DocsMobileNav nav={docsNav} />
            <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6 lg:p-8">{children}</div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
