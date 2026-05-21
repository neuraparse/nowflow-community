import * as React from 'react'
import { Link, Section, Text } from '@react-email/components'
import { format } from 'date-fns'
import { baseStyles } from './base-styles'
import { EmailLayout } from './email-layout'

interface InvitationEmailProps {
  inviterName?: string
  organizationName?: string
  inviteLink?: string
  invitedEmail?: string
  updatedDate?: Date
}

export const InvitationEmail = ({
  inviterName = 'A team member',
  organizationName = 'an organization',
  inviteLink = '',
  invitedEmail = '',
  updatedDate = new Date(),
}: InvitationEmailProps) => {
  return (
    <EmailLayout
      preview={`You've been invited to join ${organizationName} on NowFlow`}
      showTopDivider
    >
      <Section style={baseStyles.content}>
        <Text style={baseStyles.heading}>You're invited</Text>
        <Text style={baseStyles.paragraph}>
          <strong style={{ color: '#27272a' }}>{inviterName}</strong> has invited you to join{' '}
          <strong style={{ color: '#27272a' }}>{organizationName}</strong> on NowFlow.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Link href={inviteLink} style={{ textDecoration: 'none' }}>
            <Text style={baseStyles.button}>Accept Invitation</Text>
          </Link>
        </Section>
        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          This invitation will expire in 48 hours. If you believe this invitation was sent in error,
          please ignore this email.
        </Text>
        <Text
          style={{
            ...baseStyles.footerText,
            marginTop: '40px',
            textAlign: 'left',
            color: '#d4d4d8',
          }}
        >
          This email was sent on {format(updatedDate, 'MMMM do, yyyy')} to {invitedEmail} with an
          invitation to join {organizationName} on NowFlow.
        </Text>
      </Section>
    </EmailLayout>
  )
}

export default InvitationEmail
