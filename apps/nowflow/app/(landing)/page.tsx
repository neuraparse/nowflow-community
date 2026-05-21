import { redirect } from 'next/navigation'
import { getFirstRunSetupStatus } from '@/lib/setup/first-user'
import Landing from './landing'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const status = await getFirstRunSetupStatus()
  if (status.needsSetup) {
    redirect('/setup')
  }

  return <Landing />
}
