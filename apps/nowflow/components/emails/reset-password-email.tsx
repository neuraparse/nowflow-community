import { Hr, Link, Section, Text } from '@react-email/components'
import { format } from 'date-fns'
import { baseStyles } from './base-styles'
import { EmailLayout } from './email-layout'

interface ResetPasswordEmailProps {
  username?: string
  resetLink?: string
  updatedDate?: Date
}

export const ResetPasswordEmail = ({
  username = '',
  resetLink = '',
  updatedDate = new Date(),
}: ResetPasswordEmailProps) => {
  return (
    <EmailLayout preview="Reset your password">
      <Section style={baseStyles.content}>
        <Text style={baseStyles.heading}>Reset your password</Text>

        <Text style={baseStyles.paragraph}>{username ? `Hello ${username},` : 'Hello,'}</Text>

        <Text style={baseStyles.paragraph}>
          We received a request to reset your password. Click the button below to choose a new
          password.
        </Text>

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Link href={resetLink} style={{ textDecoration: 'none' }}>
            <Text style={baseStyles.button}>Reset Password</Text>
          </Link>
        </Section>

        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          This link will expire in 24 hours.
        </Text>

        <Hr style={baseStyles.divider} />

        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          If you didn't request a password reset, you can safely ignore this email.
        </Text>

        <Text
          style={{
            ...baseStyles.paragraph,
            color: '#d4d4d8',
            fontSize: '12px',
            marginTop: '24px',
          }}
        >
          Requested on {format(updatedDate, 'MMMM d, yyyy')} at {format(updatedDate, 'h:mm a')}
        </Text>
      </Section>
    </EmailLayout>
  )
}

export default ResetPasswordEmail
