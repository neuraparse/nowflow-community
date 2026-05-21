'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home page
    router.push('/w')
  }, [router])

  return null
}
