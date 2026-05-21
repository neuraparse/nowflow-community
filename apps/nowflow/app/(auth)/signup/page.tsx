import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isProd } from '@/lib/environment'
import { getFirstRunSetupStatus } from '@/lib/setup/first-user'
import SignupForm from './signup-form'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'Sign Up | NowFlow Community',
  description: 'Create a NowFlow Community account for your local workflow automation workspace.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Sign Up | NowFlow Community',
    description: 'Create an account for your local NowFlow Community workspace.',
    url: `${APP_URL}/signup`,
  },
}

export default async function SignupPage() {
  const status = await getFirstRunSetupStatus()
  if (status.needsSetup) {
    redirect('/setup')
  }

  const githubAvailable = !!(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.GITHUB_CLIENT_ID !== 'placeholder' &&
    process.env.GITHUB_CLIENT_SECRET !== 'placeholder'
  )

  const googleAvailable = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'placeholder' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'placeholder'
  )

  return (
    <SignupForm
      githubAvailable={githubAvailable}
      googleAvailable={googleAvailable}
      isProduction={isProd}
    />
  )
}
