'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// react-remove-scroll (used by Radix Dialog/Sheet/Select/DropdownMenu) locks
// body interactivity by adding `block-interactivity-<id>` (CSS:
// `pointer-events: none`) and sometimes an inline `pointer-events: none`.
// When a portal/modal unmounts during a router transition the cleanup can
// race with navigation and orphan the lock → every click on the new page is
// dead.
//
// The ONLY job of this guard is: on route change, after any in-flight
// modal has finished unmounting, drop any stray lock. We never inspect or
// remove locks mid-session, because Radix may be actively using them for
// an open dialog — interfering here caused modals to visually open but
// lose their scroll lock / close on the first outside click.

const LOCK_CLASS_PREFIX = 'block-interactivity-'

function clearStrayLocks() {
  const body = document.body
  if (!body) return

  // Never touch body while a real modal is still open. Radix content carries
  // data-state="open" in both Dialog/AlertDialog and popper portals.
  const hasLiveModal = document.querySelector(
    [
      '[role="dialog"][data-state="open"]',
      '[role="alertdialog"][data-state="open"]',
      '[data-state="open"][data-radix-focus-guard]',
      '[data-radix-popper-content-wrapper] [data-state="open"]',
      '[aria-modal="true"]',
      '[class*="allow-interactivity-"]',
    ].join(',')
  )
  if (hasLiveModal) return

  if (body.style.pointerEvents === 'none') {
    body.style.pointerEvents = ''
  }
  const stale: string[] = []
  for (const cls of body.classList) {
    if (cls.startsWith(LOCK_CLASS_PREFIX)) stale.push(cls)
  }
  if (stale.length) body.classList.remove(...stale)
}

export function PointerEventsGuard() {
  const pathname = usePathname()

  // Sweep once after each navigation. Defer one frame so any modal that was
  // open on the previous route has a chance to finish its exit transition
  // and cleanup before we consider its lock stray.
  useEffect(() => {
    const id = requestAnimationFrame(() => clearStrayLocks())
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return null
}
