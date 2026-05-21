import { NextResponse } from 'next/server'
import { ENTERPRISE_URL } from '@/lib/community/enterprise'

export const dynamic = 'force-dynamic'

const UNAVAILABLE_RESPONSE = {
  success: false,
  code: 'AGENT_PROFILES_UNAVAILABLE',
  error: 'Agent profiles are not included in this community build.',
  upgradeUrl: ENTERPRISE_URL,
}

export async function GET() {
  return NextResponse.json(UNAVAILABLE_RESPONSE, {
    status: 403,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function PATCH() {
  return NextResponse.json(UNAVAILABLE_RESPONSE, {
    status: 403,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function DELETE() {
  return NextResponse.json(UNAVAILABLE_RESPONSE, {
    status: 403,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
