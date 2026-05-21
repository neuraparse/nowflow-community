import { Suspense } from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isProd } from '@/lib/environment'
import { getFirstRunSetupStatus } from '@/lib/setup/first-user'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'Login | NowFlow Community',
  description: 'Sign in to your local NowFlow Community workspace.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Login | NowFlow Community',
    description: 'Sign in to access your local workflow automation workspace.',
    url: `${APP_URL}/login`,
  },
}

export default async function LoginPage() {
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
    <Suspense>
      <LoginForm
        githubAvailable={githubAvailable}
        googleAvailable={googleAvailable}
        isProduction={isProd}
      />
    </Suspense>
  )
}
