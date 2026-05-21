import * as React from 'react'
import { Link, Section, Text } from '@react-email/components'
import { baseStyles } from './base-styles'
import { EMAIL_BASE_URL, EmailLayout } from './email-layout'

interface AccountWelcomeEmailProps {
  name?: string
  email?: string
  password?: string
  loginUrl?: string
}

export const AccountWelcomeEmail = ({
  name = '',
  email = '',
  password = '',
  loginUrl = `${EMAIL_BASE_URL}/signin`,
}: AccountWelcomeEmailProps) => {
  return (
    <EmailLayout preview="Welcome to NowFlow - Your Account Has Been Created!" showTopDivider>
      <Section style={baseStyles.content}>
        <Text style={baseStyles.heading}>Welcome to NowFlow</Text>
        <Text style={baseStyles.paragraph}>
          Hi {name}, your account has been created for your NowFlow workspace.
        </Text>

        <Section style={baseStyles.infoBox}>
          <Text style={{ ...baseStyles.metaLabel, marginBottom: '12px' }}>
            Your Login Credentials
          </Text>
          <Text style={{ ...baseStyles.paragraph, margin: '0 0 6px 0', color: '#3f3f46' }}>
            <strong>Email:</strong> {email}
          </Text>
          {password && (
            <Text style={{ ...baseStyles.paragraph, margin: '0', color: '#3f3f46' }}>
              <strong>Password:</strong> {password}
            </Text>
          )}
        </Section>

        {password && (
          <Section style={baseStyles.dangerBox}>
            <Text
              style={{
                ...baseStyles.paragraph,
                fontSize: '13px',
                color: '#dc2626',
                margin: '0',
              }}
            >
              <strong>Important:</strong> Please change your password after your first login for
              security purposes.
            </Text>
          </Section>
        )}

        <Text style={baseStyles.paragraph}>
          Click the button below to log in and start building:
        </Text>

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Link href={loginUrl} style={{ textDecoration: 'none' }}>
            <Text style={baseStyles.button}>Log In to NowFlow</Text>
          </Link>
        </Section>

        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          If you have any questions or need assistance getting started, feel free to reach out to
          our support team.
        </Text>
      </Section>
    </EmailLayout>
  )
}

export default AccountWelcomeEmail
