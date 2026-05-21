import type { Metadata } from 'next'
import ForgotPasswordForm from './forgot-password-form'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'Forgot Password | NowFlow Community',
  description: 'Request a password reset link for your NowFlow Community account.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Forgot Password | NowFlow Community',
    description: 'Request a password reset link for your NowFlow Community account.',
    url: `${APP_URL}/forgot-password`,
  },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const email = typeof params?.email === 'string' ? params.email : undefined
  return <ForgotPasswordForm initialEmail={email} />
}
