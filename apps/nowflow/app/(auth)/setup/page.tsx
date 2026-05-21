import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getFirstRunSetupStatus } from '@/lib/setup/first-user'
import SetupForm from './setup-form'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'Initial Setup | NowFlow Community',
  description: 'Create the first local NowFlow Community account.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Initial Setup | NowFlow Community',
    description: 'Create the first local NowFlow Community account.',
    url: `${APP_URL}/setup`,
  },
}

export default async function SetupPage() {
  const status = await getFirstRunSetupStatus()

  if (!status.needsSetup) {
    redirect('/login')
  }

  return <SetupForm />
}
