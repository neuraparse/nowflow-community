import * as React from 'react'
import { Link, Section, Text } from '@react-email/components'
import { baseStyles } from './base-styles'
import { EmailLayout } from './email-layout'

interface WaitlistApprovalEmailProps {
  email?: string
  signupLink?: string
}

export const WaitlistApprovalEmail = ({
  email = '',
  signupLink = '',
}: WaitlistApprovalEmailProps) => {
  return (
    <EmailLayout preview="You've Been Approved to Join NowFlow!" showTopDivider>
      <Section style={baseStyles.content}>
        <Text style={baseStyles.heading}>You're approved</Text>
        <Text style={baseStyles.paragraph}>
          Your email ({email}) has been approved. You can now create your account and start building
          with NowFlow.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Link href={signupLink} style={{ textDecoration: 'none' }}>
            <Text style={baseStyles.button}>Create Your Account</Text>
          </Link>
        </Section>
        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          This approval link will expire in 7 days. If you have any questions or need assistance,
          feel free to reach out to our support team.
        </Text>
      </Section>
    </EmailLayout>
  )
}

export default WaitlistApprovalEmail
