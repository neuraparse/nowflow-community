import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import GalaxyBackground from './components/galaxy-background'
import LandingAnalytics from './components/landing-analytics'
import NavWrapper from './components/nav-wrapper'
import Features from './components/sections/features'
import Hero from './components/sections/hero'

// Lazy load below-the-fold components for better performance
const Templates = dynamic(() => import('./components/sections/templates'), {
  loading: () => <div className="min-h-[400px]" />,
})
const UseCases = dynamic(() => import('./components/sections/use-cases'), {
  loading: () => <div className="min-h-[400px]" />,
})
const IntegrationsShowcase = dynamic(() => import('./components/sections/integrations-showcase'), {
  loading: () => <div className="min-h-[400px]" />,
})
const Testimonials = dynamic(() => import('./components/sections/testimonials'), {
  loading: () => <div className="min-h-[400px]" />,
})
const Pricing = dynamic(() => import('./components/sections/pricing'), {
  loading: () => <div className="min-h-[400px]" />,
})
const Enterprise = dynamic(() => import('./components/sections/enterprise'), {
  loading: () => <div className="min-h-[400px]" />,
})
const FAQ = dynamic(() => import('./components/sections/faq'), {
  loading: () => <div className="min-h-[400px]" />,
})
const Footer = dynamic(() => import('./components/sections/footer'), {
  loading: () => <div className="min-h-[300px]" />,
})

export default function Landing() {
  return (
    <main
      id="main-content"
      className="odyssey-landing community-ui-framework community-ui-landing community-ui-landing-root dark relative min-h-screen bg-[#f4f5f7] dark:bg-[#090909] font-body text-zinc-800 dark:text-white"
    >
      <div aria-hidden="true" className="community-ui-scene-backdrop" />
      <NavWrapper />

      {/* Galaxy wrapper — spans hero + features for smooth transition in dark mode */}
      <div className="community-ui-hero-stack relative">
        <GalaxyBackground />

        {/* Hero Section */}
        <Hero />

        {/* Dot separator (light mode only) */}
        <div className="community-ui-landing-rule relative py-2 dark:hidden" aria-hidden="true">
          <div className="mx-auto max-w-5xl px-6">
            <div className="community-ui-landing-rule-line h-px bg-linear-to-r from-transparent via-black/[0.04] to-transparent" />
          </div>
        </div>

        {/* Features Section */}
        <Features />
      </div>

      {/* Templates - Pre-built workflow templates */}
      <Templates />

      {/* Integrations Showcase - Visual proof of extensible integrations */}
      <IntegrationsShowcase />

      {/* Use Cases - Real-world applications */}
      <UseCases />

      {/* Dot separator — Use Cases to Testimonials */}
      <div className="community-ui-landing-rule relative py-2 bg-transparent" aria-hidden="true">
        <div className="mx-auto max-w-5xl px-6">
          <div className="community-ui-landing-rule-line h-px bg-linear-to-r from-transparent via-black/[0.04] dark:via-white/[0.04] to-transparent" />
        </div>
      </div>

      {/* Testimonials - Social proof */}
      <Testimonials />

      {/* Pricing - Clear value proposition */}
      <Pricing />

      {/* Enterprise - Clear upgrade path for managed features */}
      <Enterprise />

      {/* FAQ - Address concerns */}
      <FAQ />

      {/* Footer - Final CTA */}
      <Footer />

      {/* Analytics */}
      <Suspense fallback={null}>
        <LandingAnalytics />
      </Suspense>
    </main>
  )
}
