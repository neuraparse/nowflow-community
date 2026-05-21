import * as React from 'react'
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import { format } from 'date-fns'
import { baseStyles } from './base-styles'
import EmailFooter from './footer'

interface WorkflowFailureEmailProps {
  userName?: string
  workflowName?: string
  failureDate?: Date
  errorMessage?: string
  executionTime?: string
  detailsLink?: string
  userEmail?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const WorkflowFailureEmail = ({
  userName = 'User',
  workflowName = 'Your workflow',
  failureDate = new Date(),
  errorMessage = 'An unexpected error occurred during workflow execution',
  executionTime = '1m 15s',
  detailsLink = '',
  userEmail = '',
}: WorkflowFailureEmailProps) => {
  return (
    <Html>
      <Head>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');`}</style>
      </Head>
      <Body style={baseStyles.main}>
        <Preview>{workflowName} failed on NowFlow - Action may be required</Preview>
        <Container style={baseStyles.container}>
          {/* Accent bar */}
          <div
            style={{
              ...baseStyles.accentBar,
              background: 'linear-gradient(90deg, #dc2626, #f87171)',
            }}
          />

          <Section style={baseStyles.header}>
            <div style={baseStyles.logoCard}>
              <Img
                src={`${baseUrl}/static/nowflow-logo-email.png`}
                width="48"
                alt="NowFlow"
                style={baseStyles.logo}
              />
            </div>
          </Section>

          <Section style={baseStyles.sectionsBorders}>
            <Row>
              <Column style={baseStyles.sectionBorder} />
              <Column style={baseStyles.sectionCenter} />
              <Column style={baseStyles.sectionBorder} />
            </Row>
          </Section>

          <Section style={baseStyles.content}>
            <Text style={baseStyles.heading}>Workflow failed</Text>
            <Text style={baseStyles.paragraph}>
              Hello {userName}, your workflow{' '}
              <strong style={{ color: '#27272a' }}>{workflowName}</strong> failed during execution.
            </Text>

            <Section style={baseStyles.dangerBox}>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingBottom: '10px' }}>
                      <Text style={{ ...baseStyles.metaLabel, margin: '0' }}>Error</Text>
                      <Text
                        style={{
                          ...baseStyles.paragraph,
                          margin: '0',
                          fontSize: '13px',
                          color: '#dc2626',
                        }}
                      >
                        {errorMessage}
                      </Text>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ paddingBottom: '8px' }}>
                      <Text style={{ ...baseStyles.metaLabel, margin: '0' }}>Failed at</Text>
                      <Text style={{ ...baseStyles.metaValue, margin: '0' }}>
                        {format(failureDate, 'MMMM do, yyyy')} at {format(failureDate, 'h:mm a')}
                      </Text>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Text style={{ ...baseStyles.metaLabel, margin: '0' }}>Execution Time</Text>
                      <Text style={{ ...baseStyles.metaValue, margin: '0' }}>{executionTime}</Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {detailsLink && (
              <Section style={{ textAlign: 'center', margin: '28px 0' }}>
                <Link href={detailsLink} style={{ textDecoration: 'none' }}>
                  <Text style={baseStyles.button}>View Error Details</Text>
                </Link>
              </Section>
            )}

            <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
              Please review the error details in your dashboard to diagnose and resolve the issue.
            </Text>
            {userEmail && (
              <Text
                style={{
                  ...baseStyles.footerText,
                  marginTop: '32px',
                  textAlign: 'left',
                  color: '#d4d4d8',
                }}
              >
                This notification was sent to {userEmail} regarding workflow execution on NowFlow.
              </Text>
            )}
          </Section>
        </Container>

        <EmailFooter baseUrl={baseUrl} />
      </Body>
    </Html>
  )
}

export default WorkflowFailureEmail
