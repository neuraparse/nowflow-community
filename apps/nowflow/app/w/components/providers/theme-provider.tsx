'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useGeneralStore } from '@/stores/settings/general/store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const storeTheme = useGeneralStore((state) => state.theme)
  const { setTheme } = useTheme()

  useEffect(() => {
    // Sync Zustand store theme preference -> next-themes
    setTheme(storeTheme) // 'system' | 'light' | 'dark'
  }, [storeTheme, setTheme])

  return children
}
