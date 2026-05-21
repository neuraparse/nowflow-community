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

interface WorkflowCompletionEmailProps {
  userName?: string
  workflowName?: string
  completionDate?: Date
  executionTime?: string
  resultLink?: string
  userEmail?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const WorkflowCompletionEmail = ({
  userName = 'User',
  workflowName = 'Your workflow',
  completionDate = new Date(),
  executionTime = '2m 34s',
  resultLink = '',
  userEmail = '',
}: WorkflowCompletionEmailProps) => {
  return (
    <Html>
      <Head>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');`}</style>
      </Head>
      <Body style={baseStyles.main}>
        <Preview>{workflowName} completed successfully on NowFlow</Preview>
        <Container style={baseStyles.container}>
          {/* Accent bar */}
          <div style={baseStyles.accentBar} />

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
            <Text style={baseStyles.heading}>Workflow completed</Text>
            <Text style={baseStyles.paragraph}>
              Hello {userName}, your workflow{' '}
              <strong style={{ color: '#27272a' }}>{workflowName}</strong> has completed
              successfully.
            </Text>

            <Section style={baseStyles.successBox}>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingBottom: '8px' }}>
                      <Text style={{ ...baseStyles.metaLabel, margin: '0' }}>Completed</Text>
                      <Text style={{ ...baseStyles.metaValue, margin: '0' }}>
                        {format(completionDate, 'MMMM do, yyyy')} at{' '}
                        {format(completionDate, 'h:mm a')}
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

            {resultLink && (
              <Section style={{ textAlign: 'center', margin: '28px 0' }}>
                <Link href={resultLink} style={{ textDecoration: 'none' }}>
                  <Text style={baseStyles.button}>View Results</Text>
                </Link>
              </Section>
            )}

            <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
              You can view detailed execution logs and results in your NowFlow dashboard.
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

export default WorkflowCompletionEmail
