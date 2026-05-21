import { APP_DOMAIN } from '@/lib/config/app-urls'

export type EmailTemplateId =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'chat-access'
  | 'reset-password'
  | 'waitlist-confirmation'
  | 'waitlist-approval'
  | 'invitation'
  | 'account-welcome'

export type EmailTemplateFormat = 'html' | 'text'

export type EmailTemplateEditor = 'raw' | 'builder'

export interface EmailTemplateDefinition {
  id: EmailTemplateId
  label: string
  description: string
  requiredTokens: string[]
  sampleData: Record<string, string>
}

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    id: 'sign-in',
    label: 'OTP: Sign-in',
    description: 'One-time passcode for signing in.',
    requiredTokens: ['otp'],
    sampleData: { otp: '123456', email: 'user@example.com' },
  },
  {
    id: 'email-verification',
    label: 'OTP: Email verification',
    description: 'One-time passcode for verifying email address.',
    requiredTokens: ['otp'],
    sampleData: { otp: '123456', email: 'user@example.com' },
  },
  {
    id: 'forget-password',
    label: 'OTP: Forgot password',
    description: 'One-time passcode for the forgot-password OTP flow.',
    requiredTokens: ['otp'],
    sampleData: { otp: '123456', email: 'user@example.com' },
  },
  {
    id: 'chat-access',
    label: 'OTP: Chat access',
    description: 'One-time passcode for accessing an email-protected chat.',
    requiredTokens: ['otp', 'chatTitle'],
    sampleData: { otp: '123456', email: 'user@example.com', chatTitle: 'Demo Chat' },
  },
  {
    id: 'reset-password',
    label: 'Reset password',
    description: 'Password reset email with reset link.',
    requiredTokens: ['resetLink'],
    sampleData: { username: 'Jane', resetLink: `${APP_DOMAIN}/reset?token=demo` },
  },
  {
    id: 'waitlist-confirmation',
    label: 'Waitlist confirmation',
    description: 'Confirmation email after joining the waitlist.',
    requiredTokens: ['email'],
    sampleData: { email: 'user@example.com' },
  },
  {
    id: 'waitlist-approval',
    label: 'Waitlist approval',
    description: 'Approval email with signup link.',
    requiredTokens: ['signupLink', 'email'],
    sampleData: { email: 'user@example.com', signupLink: `${APP_DOMAIN}/signup` },
  },
  {
    id: 'invitation',
    label: 'Organization invitation',
    description: 'Invite email with invitation link.',
    requiredTokens: ['inviteLink', 'organizationName'],
    sampleData: {
      inviterName: 'A team member',
      organizationName: 'Acme Inc',
      inviteLink: `${APP_DOMAIN}/invite/demo`,
      invitedEmail: 'user@example.com',
    },
  },
  {
    id: 'account-welcome',
    label: 'Account welcome',
    description: 'Welcome email sent when a workspace account is created.',
    requiredTokens: ['email', 'loginUrl'],
    sampleData: {
      name: 'Jane',
      email: 'user@example.com',
      password: 'temp-password',
      loginUrl: `${APP_DOMAIN}/signin`,
    },
  },
]

export function getEmailTemplateDefinition(id: EmailTemplateId): EmailTemplateDefinition {
  const def = EMAIL_TEMPLATES.find((t) => t.id === id)
  if (!def) {
    throw new Error(`Unknown email template id: ${id}`)
  }
  return def
}
