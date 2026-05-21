'use client'

import { useEffect } from 'react'

export function ContextMenuPrevention() {
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      // Prevent default context menu globally
      e.preventDefault()
      return false
    }

    // Add event listener to prevent context menu
    document.addEventListener('contextmenu', preventContextMenu, { passive: false })

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [])

  return null
}
