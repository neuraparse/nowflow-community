'use client'

import { usePathname } from 'next/navigation'
import NavClient from './nav-client'

export default function NavWrapper() {
  const pathname = usePathname()

  return <NavClient currentPath={pathname} />
}
