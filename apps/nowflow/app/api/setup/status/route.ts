import { NextResponse } from 'next/server'
import { getFirstRunSetupStatus } from '@/lib/setup/first-user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getFirstRunSetupStatus()

  return NextResponse.json(
    {
      needsSetup: status.needsSetup,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
