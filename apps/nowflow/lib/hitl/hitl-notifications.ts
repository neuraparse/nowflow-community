import { eq } from 'drizzle-orm'
import { APP_DOMAIN } from '@/lib/config/app-urls'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlRequest, workflow } from '@/db/schema'
import { getHITLRequest } from './hitl-service'
import type { HITLPriority, HITLRequestData, HITLRequestType } from './hitl-types'

const logger = createLogger('HITLService')

/**
 * Sends notifications for a HITL request
 */
export async function sendNotifications(requestId: string): Promise<void> {
  try {
    const request = await getHITLRequest(requestId)
    if (!request || request.notificationSent) {
      return
    }

    const channels = request.notificationChannels || ['email']

    for (const channel of channels) {
      switch (channel) {
        case 'email':
          await sendEmailNotification(request)
          break
        case 'slack':
          await sendSlackNotification(request)
          break
        case 'webhook':
          await sendWebhookNotification(request)
          break
      }
    }

    await db
      .update(hitlRequest)
      .set({ notificationSent: true })
      .where(eq(hitlRequest.id, requestId))

    logger.info('Sent HITL notifications', { requestId, channels })
  } catch (error) {
    logger.error('Failed to send notifications', { requestId, error })
    throw error
  }
}

/**
 * Send email notification for HITL request
 * Uses internal API to send email (to avoid importing nodemailer in client bundles)
 */
async function sendEmailNotification(request: HITLRequestData): Promise<void> {
  if (!request.assignedToEmail) {
    logger.warn('No email address for HITL notification', { requestId: request.id })
    return
  }

  try {
    // Get workflow info for context
    let workflowName = 'Unknown Workflow'
    let nextBlockName = ''
    let nextBlockType = ''

    try {
      const [wf] = await db
        .select({ name: workflow.name, state: workflow.state })
        .from(workflow)
        .where(eq(workflow.id, request.workflowId))
        .limit(1)

      if (wf) {
        workflowName = wf.name

        // Try to find the next block after approval
        if (wf.state && request.blockId) {
          const state = typeof wf.state === 'string' ? JSON.parse(wf.state) : wf.state
          const edges = state.edges || []
          const blocks = state.blocks || {}

          // Find connections from approval block
          const nextEdge = edges.find((edge: any) => edge.source === request.blockId)
          if (nextEdge && nextEdge.target) {
            const nextBlock = blocks[nextEdge.target]
            if (nextBlock) {
              nextBlockName = nextBlock.name || 'Next Block'
              nextBlockType = nextBlock.type || ''
            }
          }
        }
      }
    } catch {
      // Ignore workflow lookup errors
    }

    const baseUrl = APP_DOMAIN
    const reviewUrl = `${baseUrl}/w/${request.workflowId}?hitl=${request.id}`

    // Generate secure tokens for one-click approve/reject
    const { generateHITLTokens } = await import('@/app/api/hitl/requests/[id]/quick-respond/route')
    const { approveToken, rejectToken } = generateHITLTokens(request.id)

    const approveUrl = `${baseUrl}/api/hitl/requests/${request.id}/quick-respond?action=approve&token=${approveToken}`
    const rejectUrl = `${baseUrl}/api/hitl/requests/${request.id}/quick-respond?action=reject&token=${rejectToken}`

    const priorityColors: Record<HITLPriority, string> = {
      low: '#6B7280',
      normal: '#3B82F6',
      high: '#F59E0B',
      urgent: '#EF4444',
    }

    const priorityLabels: Record<HITLPriority, string> = {
      low: 'Low Priority',
      normal: 'Normal Priority',
      high: 'High Priority',
      urgent: 'URGENT',
    }

    const requestTypeLabels: Record<string, string> = {
      approval: 'Approval Required',
      input: 'Input Needed',
      review: 'Review Required',
      escalation: 'Escalation',
    }

    const createdAtFormatted = request.createdAt
      ? new Date(request.createdAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : ''

    const timeoutFormatted = request.timeoutAt
      ? new Date(request.timeoutAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : ''

    const isUrgent = request.priority === 'urgent' || request.priority === 'high'
    const brandName = process.env.EMAIL_BRAND_NAME || 'NowFlow'
    const logoUrl = process.env.EMAIL_BRAND_LOGO_URL || `${baseUrl}/static/nowflow-logo-email.png`

    const html = buildEmailHtml({
      request,
      workflowName,
      nextBlockName,
      nextBlockType,
      reviewUrl,
      approveUrl,
      rejectUrl,
      priorityColors,
      priorityLabels,
      requestTypeLabels,
      createdAtFormatted,
      timeoutFormatted,
      isUrgent,
      brandName,
      logoUrl,
      baseUrl,
    })

    // Use internal API to send email — hitl-service.ts is in the client bundle chain
    // (via tools/hitl_approval → tools/registry → blocks → stores → client components)
    // so we cannot import nodemailer here, even with dynamic import.
    // Use 127.0.0.1 explicitly (not "localhost" which may resolve to IPv6 ::1)
    const port = process.env.PORT || 3000
    const internalSecret = process.env.INTERNAL_API_KEY || process.env.BETTER_AUTH_SECRET || ''
    const response = await fetch(`http://127.0.0.1:${port}/api/internal/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': internalSecret,
      },
      body: JSON.stringify({
        to: request.assignedToEmail,
        subject: `[${priorityLabels[request.priority]}] ${request.title} - Action Required`,
        html,
      }),
    })

    if (response.ok) {
      logger.info('HITL email notification sent', {
        requestId: request.id,
        email: request.assignedToEmail,
      })
    } else {
      const errorBody = await response.text().catch(() => '')
      logger.error('Failed to send HITL email notification', {
        requestId: request.id,
        status: response.status,
        error: errorBody,
      })
    }
  } catch (error: any) {
    logger.error('Error sending HITL email notification', {
      requestId: request.id,
      error: error?.message || String(error),
    })
  }
}

/**
 * Builds the HTML email template for HITL notifications
 */
function buildEmailHtml(params: {
  request: HITLRequestData
  workflowName: string
  nextBlockName: string
  nextBlockType: string
  reviewUrl: string
  approveUrl: string
  rejectUrl: string
  priorityColors: Record<HITLPriority, string>
  priorityLabels: Record<HITLPriority, string>
  requestTypeLabels: Record<string, string>
  createdAtFormatted: string
  timeoutFormatted: string
  isUrgent: boolean
  brandName: string
  logoUrl: string
  baseUrl: string
}): string {
  const {
    request,
    workflowName,
    nextBlockName,
    nextBlockType,
    reviewUrl,
    approveUrl,
    rejectUrl,
    priorityColors,
    priorityLabels,
    requestTypeLabels,
    createdAtFormatted,
    timeoutFormatted,
    isUrgent,
    brandName,
    logoUrl,
    baseUrl,
  } = params

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${request.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; }
    @media only screen and (max-width: 580px) {
      .outer { width: 100% !important; }
      .inner { padding: 28px 20px !important; }
      .btn-col { display: block !important; width: 100% !important; padding: 0 !important; padding-bottom: 10px !important; }
      .meta-col { display: block !important; width: 100% !important; padding: 0 0 14px 0 !important; }
      .title-h1 { font-size: 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .body-bg { background-color: #0f172a !important; }
      .card-el { background-color: #1e293b !important; border-color: rgba(255,255,255,0.06) !important; }
      .t1 { color: #f1f5f9 !important; }
      .t2 { color: #94a3b8 !important; }
      .t3 { color: #64748b !important; }
      .div-el { background-color: rgba(255,255,255,0.06) !important; }
      .mbox { background-color: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.08) !important; }
      .badge-el { background-color: rgba(255,255,255,0.06) !important; }
      .btn-g { background-color: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.08) !important; color: #94a3b8 !important; }
    }
  </style>
  <!--[if mso]>
  <style>body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
  <![endif]-->
</head>
<body class="body-bg" style="margin:0;padding:0;background:#fafafa;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <!--[if mso]><div style="background-color:#fafafa"><![endif]-->

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#fafafa;">
    ${requestTypeLabels[request.requestType] || 'Action Required'}: ${request.title} — ${workflowName}${isUrgent ? ' [' + priorityLabels[request.priority].toUpperCase() + ']' : ''}
    ${'&nbsp;&zwnj;'.repeat(30)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="body-bg" style="background:#fafafa;">
    <tr>
      <td align="center" style="padding:52px 16px 44px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" class="outer" style="max-width:520px;width:100%;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:32px;height:32px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.04);">
                    <img src="${logoUrl}" width="32" height="32" alt="${brandName}" style="display:block;width:32px;height:32px;object-fit:contain;">
                  </td>
                  <td style="padding-left:10px;">
                    <span class="t1" style="font-size:17px;font-weight:500;color:#27272a;letter-spacing:-0.03em;">${brandName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card-el" style="background:#fff;border-radius:20px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 2px rgba(0,0,0,0.03),0 8px 32px rgba(0,0,0,0.05);">
              <div style="height:3px;border-radius:20px 20px 0 0;background:linear-gradient(90deg,#5B7B6F,#4A7A68,#6B8F80);"></div>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                ${
                  isUrgent
                    ? `
                <tr>
                  <td style="padding:16px 36px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:5px 14px;border-radius:100px;background:${request.priority === 'urgent' ? '#fef2f2' : '#fffbeb'};">
                          <span style="font-size:11px;font-weight:600;color:${request.priority === 'urgent' ? '#b91c1c' : '#b45309'};letter-spacing:0.02em;">
                            ${request.priority === 'urgent' ? '&#9679; Immediate attention required' : '&#9679; Review soon — high priority'}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `
                    : ''
                }

                <!-- Header -->
                <tr>
                  <td class="inner" style="padding:${isUrgent ? '20px' : '36px'} 36px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                      <tr>
                        <td class="badge-el" style="padding:4px 14px;border-radius:100px;background:#f4f4f5;">
                          <span class="t3" style="font-size:10px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.1em;">${requestTypeLabels[request.requestType] || 'Action Required'}</span>
                        </td>
                        ${
                          request.priority !== 'normal'
                            ? `
                        <td style="padding-left:8px;">
                          <span style="font-size:10px;font-weight:600;color:${priorityColors[request.priority]};text-transform:uppercase;letter-spacing:0.05em;">&#9679; ${priorityLabels[request.priority]}</span>
                        </td>
                        `
                            : ''
                        }
                      </tr>
                    </table>
                    <h1 class="t1 title-h1" style="margin:0 0 6px;font-size:24px;font-weight:300;color:#27272a;line-height:1.2;letter-spacing:-0.03em;">
                      ${request.title}
                    </h1>
                    <p class="t3" style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.3;font-weight:500;letter-spacing:0.02em;">
                      ${workflowName}
                    </p>
                  </td>
                </tr>

                ${
                  request.description
                    ? `
                <tr>
                  <td style="padding:20px 36px 0;">
                    <p class="t2" style="margin:0;font-size:15px;color:#71717a;line-height:1.7;font-weight:400;">
                      ${request.description}
                    </p>
                  </td>
                </tr>
                `
                    : ''
                }

                <tr>
                  <td style="padding:24px 36px 0;">
                    <div class="div-el" style="height:1px;background:rgba(0,0,0,0.05);"></div>
                  </td>
                </tr>

                <!-- Info -->
                <tr>
                  <td style="padding:22px 36px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td class="meta-col" width="50%" valign="top" style="padding-right:12px;padding-bottom:18px;">
                          <p class="t3" style="margin:0 0 4px;font-size:10px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.12em;">Workflow</p>
                          <p class="t1" style="margin:0;font-size:14px;font-weight:500;color:#27272a;">${workflowName}</p>
                        </td>
                        <td class="meta-col" width="50%" valign="top" style="padding-left:12px;padding-bottom:18px;">
                          <p class="t3" style="margin:0 0 4px;font-size:10px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.12em;">Execution</p>
                          <p class="t1" style="margin:0;font-size:13px;font-weight:500;color:#27272a;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${request.executionId.substring(0, 12)}</p>
                        </td>
                      </tr>
                      <tr>
                        ${
                          createdAtFormatted
                            ? `
                        <td class="meta-col" width="50%" valign="top" style="padding-right:12px;padding-bottom:18px;">
                          <p class="t3" style="margin:0 0 4px;font-size:10px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.12em;">Created</p>
                          <p class="t2" style="margin:0;font-size:14px;font-weight:500;color:#71717a;">${createdAtFormatted}</p>
                        </td>
                        `
                            : '<td class="meta-col" width="50%"></td>'
                        }
                        <td class="meta-col" width="50%" valign="top" style="padding-left:12px;padding-bottom:18px;">
                          <p class="t3" style="margin:0 0 4px;font-size:10px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.12em;">${timeoutFormatted ? 'Expires' : 'Status'}</p>
                          ${
                            timeoutFormatted
                              ? `<p style="margin:0;font-size:14px;font-weight:600;color:#b91c1c;">${timeoutFormatted}</p>`
                              : '<p style="margin:0;font-size:14px;font-weight:500;color:#4A7A68;">Awaiting response</p>'
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${
                  nextBlockName
                    ? `
                <tr>
                  <td style="padding:0 36px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mbox" style="background:#fafafa;border:1px solid rgba(0,0,0,0.05);border-radius:12px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <p class="t2" style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
                            <span class="t3" style="color:#a1a1aa;">Next &#8594;</span> <strong class="t1" style="font-weight:600;color:#27272a;">${nextBlockName}</strong>${nextBlockType ? ` <span class="t3" style="color:#a1a1aa;">(${nextBlockType})</span>` : ''}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `
                    : ''
                }

                <tr>
                  <td style="padding:${nextBlockName ? '22px' : '4px'} 36px 0;">
                    <div class="div-el" style="height:1px;background:rgba(0,0,0,0.05);"></div>
                  </td>
                </tr>

                <!-- Buttons -->
                <tr>
                  <td class="inner" style="padding:24px 36px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td class="btn-col" width="50%" align="center" style="padding-right:5px;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${approveUrl}" style="height:46px;v-text-anchor:middle;width:210px;" arcsize="22%" fillcolor="#3f3f46">
                            <w:anchorlock/><center style="color:#fff;font-family:Arial;font-size:13px;font-weight:bold;">Approve</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${approveUrl}" target="_blank" style="display:block;background:#27272a;color:#fff;padding:13px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:13px;text-align:center;line-height:1.2;letter-spacing:0.02em;">
                            Approve
                          </a>
                          <!--<![endif]-->
                        </td>
                        <td class="btn-col" width="50%" align="center" style="padding-left:5px;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${rejectUrl}" style="height:46px;v-text-anchor:middle;width:210px;" arcsize="22%" strokecolor="#e4e4e7" fillcolor="#fafafa">
                            <w:anchorlock/><center style="color:#71717a;font-family:Arial;font-size:13px;font-weight:bold;">Reject</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${rejectUrl}" target="_blank" class="btn-g" style="display:block;background:#fafafa;color:#71717a;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;font-size:13px;text-align:center;line-height:1.2;border:1px solid rgba(0,0,0,0.08);letter-spacing:0.02em;">
                            Reject
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 36px 32px;" align="center">
                    <a href="${reviewUrl}" target="_blank" class="t3" style="font-size:12px;color:#a1a1aa;text-decoration:none;font-weight:500;letter-spacing:0.04em;">
                      Review in dashboard <span style="font-size:11px;">&#8594;</span>
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;" align="center">
              <p class="t3" style="margin:0 0 4px;font-size:12px;color:#d4d4d8;">
                <a href="${baseUrl}" class="t3" style="color:#a1a1aa;text-decoration:none;font-weight:500;letter-spacing:-0.03em;">${brandName}</a>
              </p>
              <p style="margin:0;font-size:10px;color:#d4d4d8;letter-spacing:0.02em;">
                Automated notification &middot; Do not reply
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!--[if mso]></div><![endif]-->
</body>
</html>`
}

/**
 * Send Slack notification for HITL request
 */
async function sendSlackNotification(request: HITLRequestData): Promise<void> {
  const webhookUrl = process.env.HITL_SLACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    logger.warn('No Slack webhook URL configured for HITL notifications')
    return
  }

  try {
    const baseUrl = APP_DOMAIN
    const approvalUrl = `${baseUrl}/w/${request.workflowId}?hitl=${request.id}`

    const priorityEmoji: Record<HITLPriority, string> = {
      low: '🔵',
      normal: '🟢',
      high: '🟠',
      urgent: '🔴',
    }

    const requestTypeEmoji: Record<HITLRequestType, string> = {
      approval: '✅',
      input: '📝',
      review: '👀',
      escalation: '⬆️',
    }

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${priorityEmoji[request.priority]} HITL Request: ${request.title}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Type:*\n${requestTypeEmoji[request.requestType]} ${request.requestType.charAt(0).toUpperCase() + request.requestType.slice(1)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Priority:*\n${request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}`,
            },
          ],
        },
        ...(request.description
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: request.description,
                },
              },
            ]
          : []),
        ...(request.timeoutAt
          ? [
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `⏰ Timeout: <!date^${Math.floor(new Date(request.timeoutAt).getTime() / 1000)}^{date_short_pretty} at {time}|${new Date(request.timeoutAt).toISOString()}>`,
                  },
                ],
              },
            ]
          : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Review Request',
                emoji: true,
              },
              url: approvalUrl,
              style: 'primary',
            },
          ],
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      logger.info('HITL Slack notification sent', { requestId: request.id })
    } else {
      logger.error('Failed to send HITL Slack notification', {
        requestId: request.id,
        status: response.status,
      })
    }
  } catch (error) {
    logger.error('Error sending HITL Slack notification', { requestId: request.id, error })
  }
}

/**
 * Send webhook notification for HITL request
 */
async function sendWebhookNotification(request: HITLRequestData): Promise<void> {
  // Get webhook URL from request metadata or environment
  const webhookUrl = request.metadata?.webhookUrl || process.env.HITL_WEBHOOK_URL

  if (!webhookUrl) {
    logger.warn('No webhook URL configured for HITL notifications', { requestId: request.id })
    return
  }

  try {
    const payload = {
      event: 'hitl.request.created',
      timestamp: new Date().toISOString(),
      data: {
        id: request.id,
        workflowId: request.workflowId,
        executionId: request.executionId,
        blockId: request.blockId,
        requestType: request.requestType,
        title: request.title,
        description: request.description,
        priority: request.priority,
        status: request.status,
        assignedTo: request.assignedTo,
        assignedToEmail: request.assignedToEmail,
        timeoutAt: request.timeoutAt,
        createdAt: request.createdAt,
        options: request.options,
        data: request.data,
      },
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HITL-Event': 'request.created',
        'X-HITL-Request-Id': request.id,
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      logger.info('HITL webhook notification sent', { requestId: request.id, webhookUrl })
    } else {
      logger.error('Failed to send HITL webhook notification', {
        requestId: request.id,
        status: response.status,
        statusText: response.statusText,
      })
    }
  } catch (error) {
    logger.error('Error sending HITL webhook notification', { requestId: request.id, error })
  }
}
