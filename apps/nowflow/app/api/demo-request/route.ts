import { NextResponse } from 'next/server'
import { ENTERPRISE_URL } from '@/lib/community/enterprise'

export const dynamic = 'force-dynamic'

function enterpriseDemoResponse() {
  return NextResponse.json(
    {
      success: false,
      code: 'ENTERPRISE_REQUEST_EXTERNAL',
      message: 'Enterprise requests are handled on nowflow.io.',
      enterpriseUrl: ENTERPRISE_URL,
    },
    {
      status: 403,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

export async function GET() {
  return enterpriseDemoResponse()
}

export async function POST() {
  return enterpriseDemoResponse()
}
