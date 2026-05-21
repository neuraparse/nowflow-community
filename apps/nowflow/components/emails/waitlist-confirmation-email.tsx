import * as React from 'react'
import { Link, Section, Text } from '@react-email/components'
import { baseStyles } from './base-styles'
import { EmailLayout } from './email-layout'

interface WaitlistConfirmationEmailProps {
  email?: string
}

const typeformLink = ''

export const WaitlistConfirmationEmail = ({ email = '' }: WaitlistConfirmationEmailProps) => {
  return (
    <EmailLayout preview="Welcome to the NowFlow Waitlist!" showTopDivider>
      <Section style={baseStyles.content}>
        <Text style={baseStyles.heading}>You're on the list</Text>
        <Text style={baseStyles.paragraph}>
          Thank you for your interest in NowFlow. We've added your email ({email}) to our waitlist
          and will notify you as soon as you're granted access.
        </Text>
        <Text style={baseStyles.paragraph}>
          <strong style={{ color: '#27272a' }}>Want to get access sooner?</strong> Tell us about
          your use case. Schedule a 15-minute call with our team.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Link href={typeformLink} style={{ textDecoration: 'none' }}>
            <Text style={baseStyles.button}>Schedule a Call</Text>
          </Link>
        </Section>
        <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
          We're excited to help you build and optimize your agentic workflows.
        </Text>
      </Section>
    </EmailLayout>
  )
}

export default WaitlistConfirmationEmail
