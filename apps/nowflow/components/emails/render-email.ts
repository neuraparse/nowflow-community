import { render } from '@react-email/components'
import { AccountWelcomeEmail } from './account-welcome-email'
import { InvitationEmail } from './invitation-email'
import { OTPVerificationEmail } from './otp-verification-email'
import { ResetPasswordEmail } from './reset-password-email'
import { WaitlistApprovalEmail } from './waitlist-approval-email'
import { WaitlistConfirmationEmail } from './waitlist-confirmation-email'

/**
 * Renders the OTP verification email to HTML
 */
export async function renderOTPEmail(
  otp: string,
  email: string,
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'chat-access' = 'email-verification',
  chatTitle?: string
): Promise<string> {
  return await render(OTPVerificationEmail({ otp, email, type, chatTitle }))
}

/**
 * Renders the password reset email to HTML
 */
export async function renderPasswordResetEmail(
  username: string,
  resetLink: string
): Promise<string> {
  return await render(ResetPasswordEmail({ username, resetLink, updatedDate: new Date() }))
}

/**
 * Renders the invitation email to HTML
 */
export async function renderInvitationEmail(
  inviterName: string,
  organizationName: string,
  inviteLink: string,
  invitedEmail: string
): Promise<string> {
  return await render(
    InvitationEmail({
      inviterName,
      organizationName,
      inviteLink,
      invitedEmail,
      updatedDate: new Date(),
    })
  )
}

/**
 * Renders the waitlist confirmation email to HTML
 */
export async function renderWaitlistConfirmationEmail(email: string): Promise<string> {
  return await render(WaitlistConfirmationEmail({ email }))
}

/**
 * Renders the waitlist approval email to HTML
 */
export async function renderWaitlistApprovalEmail(
  email: string,
  signupLink: string
): Promise<string> {
  return await render(WaitlistApprovalEmail({ email, signupLink }))
}

/**
 * Renders the account welcome email to HTML
 */
export async function renderAccountWelcomeEmail(
  name: string,
  email: string,
  password?: string,
  loginUrl?: string
): Promise<string> {
  return await render(AccountWelcomeEmail({ name, email, password, loginUrl }))
}

/**
 * Gets the appropriate email subject based on email type
 */
export function getEmailSubject(
  type:
    | 'sign-in'
    | 'email-verification'
    | 'forget-password'
    | 'chat-access'
    | 'reset-password'
    | 'waitlist-confirmation'
    | 'waitlist-approval'
    | 'invitation'
    | 'account-welcome'
): string {
  switch (type) {
    case 'sign-in':
      return 'Sign in to NowFlow'
    case 'email-verification':
      return 'Verify your email for NowFlow'
    case 'forget-password':
      return 'Reset your NowFlow password'
    case 'chat-access':
      return 'Verification code for Chat'
    case 'reset-password':
      return 'Reset your NowFlow password'
    case 'waitlist-confirmation':
      return 'Welcome to the NowFlow Waitlist'
    case 'waitlist-approval':
      return "You've Been Approved to Join NowFlow!"
    case 'invitation':
      return "You've been invited to join a team on NowFlow"
    case 'account-welcome':
      return 'Welcome to NowFlow - Your Account Has Been Created!'
    default:
      return 'NowFlow'
  }
}
