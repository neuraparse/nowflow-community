'use client'

import dynamic from 'next/dynamic'

const HeroParticles = dynamic(() => import('./hero-particles'), { ssr: false })

export default function GalaxyBackground() {
  return (
    <div className="absolute inset-0 z-0 hidden dark:block overflow-hidden" aria-hidden="true">
      {/* Noir editorial gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 26% 8%, rgba(18, 46, 57, 0.7) 0%, transparent 70%), radial-gradient(ellipse 100% 60% at 72% 24%, rgba(30, 42, 48, 0.26) 0%, transparent 60%), radial-gradient(ellipse 80% 50% at 50% 50%, rgba(18, 30, 26, 0.18) 0%, transparent 54%)',
        }}
      />
      {/* Soft atmospheric band */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background:
            'linear-gradient(135deg, transparent 20%, rgba(156, 172, 194, 0.5) 35%, rgba(124, 154, 139, 0.24) 52%, transparent 68%)',
          filter: 'blur(54px)',
        }}
      />
      {/* Star field canvas */}
      <HeroParticles />
      {/* Bottom fade out — galaxy dissolves into page background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-80"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(8, 16, 20, 0.12) 24%, rgba(5, 10, 13, 0.34) 50%, rgba(3, 5, 7, 0.72) 78%, rgba(2, 3, 4, 0.94) 100%)',
        }}
      />
    </div>
  )
}
