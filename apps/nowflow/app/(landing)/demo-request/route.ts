import { NextResponse } from 'next/server'
import { ENTERPRISE_URL } from '@/lib/community/enterprise'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.redirect(ENTERPRISE_URL, { status: 307 })
}

export function HEAD() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: ENTERPRISE_URL,
    },
  })
}
