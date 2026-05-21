import { Hr, Section, Text } from '@react-email/components'
import { baseStyles } from './base-styles'
import { EmailLayout } from './email-layout'

interface OTPVerificationEmailProps {
  otp: string
  email?: string
  type?: 'sign-in' | 'email-verification' | 'forget-password' | 'chat-access'
  chatTitle?: string
}

const getSubjectByType = (type: string, chatTitle?: string) => {
  switch (type) {
    case 'sign-in':
      return 'Sign in to NowFlow'
    case 'email-verification':
      return 'Verify your email'
    case 'forget-password':
      return 'Reset your password'
    case 'chat-access':
      return `Verification code for ${chatTitle || 'Chat'}`
    default:
      return 'Your verification code'
  }
}

const getHeading = (type: string, chatTitle?: string) => {
  switch (type) {
    case 'sign-in':
      return 'Sign in to your account'
    case 'email-verification':
      return 'Verify your email address'
    case 'forget-password':
      return 'Reset your password'
    case 'chat-access':
      return `Access ${chatTitle || 'chat'}`
    default:
      return 'Your verification code'
  }
}

const getMessage = (type: string, chatTitle?: string) => {
  switch (type) {
    case 'sign-in':
      return 'Use the verification code below to sign in to your account.'
    case 'email-verification':
      return 'Please verify your email address to complete your registration.'
    case 'forget-password':
      return 'Use the code below to reset your password.'
    case 'chat-access':
      return `Enter the verification code below to access ${chatTitle || 'the chat'}.`
    default:
      return 'Use the verification code below to continue.'
  }
}

export const OTPVerificationEmail = ({
  otp,
  type = 'email-verification',
  chatTitle,
}: OTPVerificationEmailProps) => {
  return (
    <EmailLayout preview={getSubjectByType(type, chatTitle)}>
      <Section style={baseStyles.content}>
        <Text style={baseStyles.heading}>{getHeading(type, chatTitle)}</Text>

        <Text style={baseStyles.paragraph}>{getMessage(type, chatTitle)}</Text>

        <Section style={baseStyles.codeContainer}>
          <Text style={baseStyles.code}>{otp}</Text>
        </Section>

        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          This code will expire in 15 minutes.
        </Text>

        <Hr style={baseStyles.divider} />

        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          If you didn't request this code, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  )
}

export default OTPVerificationEmail
