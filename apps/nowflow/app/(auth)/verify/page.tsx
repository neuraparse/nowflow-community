import { isProd } from '@/lib/environment'
import { AuthShell } from '../components/auth-shell'
import { VerifyContent } from './verify-content'

export const dynamic = 'force-dynamic'

export default function VerifyPage() {
  const hasResendKey = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'placeholder'
  )

  return (
    <AuthShell>
      <VerifyContent hasResendKey={hasResendKey} isProduction={isProd} />
    </AuthShell>
  )
}
