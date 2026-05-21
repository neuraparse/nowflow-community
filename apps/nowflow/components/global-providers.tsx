'use client'

import dynamic from 'next/dynamic'
import { ThemeProvider } from 'next-themes'
import { CopilotProvider } from '@/components/copilot/copilot-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

// Lazy-load the copilot widget — pulls in framer-motion (~20KB) and
// react-markdown. Defer until after first paint to keep the initial bundle
// lean for routes that don't render the copilot immediately.
const CopilotWidget = dynamic(
  () => import('@/components/copilot/copilot-widget').then((m) => ({ default: m.CopilotWidget })),
  { ssr: false, loading: () => null }
)

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={50} skipDelayDuration={0} disableHoverableContent={false}>
        <CopilotProvider>
          {children}
          <CopilotWidget />
        </CopilotProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
