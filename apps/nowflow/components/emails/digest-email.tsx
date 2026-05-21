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

interface WorkflowStats {
  name: string
  executionCount: number
}

interface RecentFailure {
  workflowName: string
  failureDate: Date
  errorMessage: string
}

interface DigestEmailProps {
  userName?: string
  startDate?: Date
  endDate?: Date
  totalExecutions?: number
  successfulExecutions?: number
  failedExecutions?: number
  pendingApprovals?: number
  topWorkflows?: WorkflowStats[]
  recentFailures?: RecentFailure[]
  dashboardLink?: string
  userEmail?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const DigestEmail = ({
  userName = 'User',
  startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  endDate = new Date(),
  totalExecutions = 0,
  successfulExecutions = 0,
  failedExecutions = 0,
  pendingApprovals = 0,
  topWorkflows = [],
  recentFailures = [],
  dashboardLink = '',
  userEmail = '',
}: DigestEmailProps) => {
  const successRate =
    totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0

  return (
    <Html>
      <Head>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');`}</style>
      </Head>
      <Body style={baseStyles.main}>
        <Preview>
          Your NowFlow workflow digest for {format(startDate, 'MMM d')} -{' '}
          {format(endDate, 'MMM d, yyyy')}
        </Preview>
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
            <Text style={baseStyles.heading}>Activity digest</Text>
            <Text style={baseStyles.paragraph}>
              Hello {userName}, here's your workflow activity from{' '}
              <strong style={{ color: '#27272a' }}>{format(startDate, 'MMMM do')}</strong> to{' '}
              <strong style={{ color: '#27272a' }}>{format(endDate, 'MMMM do, yyyy')}</strong>.
            </Text>

            {/* Statistics Section */}
            <Section style={baseStyles.infoBox}>
              <Text style={{ ...baseStyles.metaLabel, marginBottom: '14px' }}>
                Execution Summary
              </Text>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        color: '#a1a1aa',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      Total Executions
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#27272a',
                        textAlign: 'right',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      {totalExecutions}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        color: '#a1a1aa',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      Successful
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#4A7A68',
                        textAlign: 'right',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      {successfulExecutions}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        color: '#a1a1aa',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      Failed
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#dc2626',
                        textAlign: 'right',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      {failedExecutions}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        color: '#a1a1aa',
                      }}
                    >
                      Success Rate
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#27272a',
                        textAlign: 'right',
                      }}
                    >
                      {successRate}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Pending Approvals */}
            {pendingApprovals > 0 && (
              <Section style={baseStyles.warningBox}>
                <Text
                  style={{
                    ...baseStyles.paragraph,
                    margin: '0',
                    fontSize: '13px',
                    color: '#b45309',
                  }}
                >
                  <strong>
                    {pendingApprovals} workflow{pendingApprovals !== 1 ? 's' : ''}
                  </strong>{' '}
                  {pendingApprovals !== 1 ? 'are' : 'is'} waiting for your approval.
                </Text>
              </Section>
            )}

            {/* Top Workflows */}
            {topWorkflows.length > 0 && (
              <>
                <Text style={{ ...baseStyles.metaLabel, marginTop: '28px', marginBottom: '12px' }}>
                  Most Active Workflows
                </Text>
                <Section style={baseStyles.infoBox}>
                  {topWorkflows.map((workflow, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 0',
                        borderBottom:
                          index < topWorkflows.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: '13px',
                          color: '#3f3f46',
                          margin: '0',
                          lineHeight: '1.5',
                        }}
                      >
                        <strong>{workflow.name}</strong>
                        <span style={{ color: '#a1a1aa', marginLeft: '8px' }}>
                          {workflow.executionCount} execution
                          {workflow.executionCount !== 1 ? 's' : ''}
                        </span>
                      </Text>
                    </div>
                  ))}
                </Section>
              </>
            )}

            {/* Recent Failures */}
            {recentFailures.length > 0 && (
              <>
                <Text style={{ ...baseStyles.metaLabel, marginTop: '28px', marginBottom: '12px' }}>
                  Recent Failures
                </Text>
                <Section style={baseStyles.dangerBox}>
                  {recentFailures.map((failure, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 0',
                        borderBottom:
                          index < recentFailures.length - 1 ? '1px solid #fecaca' : 'none',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: '13px',
                          color: '#3f3f46',
                          margin: '0 0 2px 0',
                          lineHeight: '1.5',
                        }}
                      >
                        <strong>{failure.workflowName}</strong>
                        <span style={{ color: '#a1a1aa', marginLeft: '8px' }}>
                          {format(failure.failureDate, 'MMM d, h:mm a')}
                        </span>
                      </Text>
                      <Text
                        style={{
                          fontSize: '12px',
                          color: '#a1a1aa',
                          margin: '0',
                          lineHeight: '1.4',
                        }}
                      >
                        {failure.errorMessage}
                      </Text>
                    </div>
                  ))}
                </Section>
              </>
            )}

            {/* Dashboard Link */}
            {dashboardLink && (
              <Section style={{ textAlign: 'center', margin: '28px 0' }}>
                <Link href={dashboardLink} style={{ textDecoration: 'none' }}>
                  <Text style={baseStyles.button}>View Dashboard</Text>
                </Link>
              </Section>
            )}

            <Text style={{ ...baseStyles.paragraph, color: '#a1a1aa', fontSize: '13px' }}>
              Keep building amazing workflows with NowFlow!
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
                This digest was sent to {userEmail}. You can manage your notification preferences in
                your account settings.
              </Text>
            )}
          </Section>
        </Container>

        <EmailFooter baseUrl={baseUrl} />
      </Body>
    </Html>
  )
}

export default DigestEmail
