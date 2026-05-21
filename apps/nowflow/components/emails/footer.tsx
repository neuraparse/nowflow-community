import { Container, Link, Section, Text } from '@react-email/components'
import { baseStyles } from './base-styles'

interface EmailFooterProps {
  baseUrl?: string
}

export const EmailFooter = ({ baseUrl }: EmailFooterProps) => {
  const resolvedBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const settingsUrl = `${resolvedBaseUrl}/settings`

  return (
    <Container>
      <Section style={baseStyles.footer}>
        <Text style={{ margin: '0 0 12px 0' }}>
          <span style={baseStyles.footerBadge}>NowFlow</span>
        </Text>
        <Text style={{ ...baseStyles.footerText, marginBottom: '8px' }}>
          <Link href={resolvedBaseUrl} style={baseStyles.footerLink}>
            {resolvedBaseUrl.replace('https://', '')}
          </Link>
        </Text>
        <Text style={{ ...baseStyles.footerText, color: '#d4d4d8' }}>
          You received this email because you have an account with NowFlow.{' '}
          <Link href={settingsUrl} style={{ ...baseStyles.footerLink, color: '#a1a1aa' }}>
            Manage notification preferences
          </Link>
        </Text>
      </Section>
    </Container>
  )
}

export default EmailFooter
