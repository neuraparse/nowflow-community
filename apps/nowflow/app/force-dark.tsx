'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

// Public surfaces (landing, docs, blog, demo-request, auth) are dark-only by
// brand. Users' localStorage / OS preference must not override that — this
// component forcibly pins both the next-themes state and the <html> class to
// dark on mount, and clears any stray `light`/`system` persistence.
export function ForceDark() {
  const { setTheme } = useTheme()

  useEffect(() => {
    try {
      localStorage.setItem('theme', 'dark')
      localStorage.removeItem('landing-theme')
    } catch {
      // storage may be unavailable (incognito, quota) — dom class override below
      // is still applied so the page renders dark either way
    }
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
    setTheme('dark')
  }, [setTheme])

  return null
}
