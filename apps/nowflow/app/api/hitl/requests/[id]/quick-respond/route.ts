import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { hitlRequest, workflow } from '@/db/schema'

const logger = createLogger('HITLQuickRespondAPI')

// Secret used for both generating and validating tokens
// Must be consistent — uses the same fallback chain everywhere
function getTokenSecret(): string | null {
  return (
    process.env.HITL_TOKEN_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    null
  )
}

function generateTokenHash(requestId: string, action: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${requestId}:${action}`)
    .digest('hex')
    .substring(0, 32)
}

function validateToken(requestId: string, action: string, token: string): boolean {
  const secret = getTokenSecret()
  if (!secret) return false
  const expectedToken = generateTokenHash(requestId, action, secret)
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(expectedToken)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const token = searchParams.get('token')

    // --- Validate params ---
    if (!action || !token) {
      return renderPage({
        type: 'error',
        title: 'Invalid Link',
        message:
          'This link is missing required parameters. It may have been truncated by your email client.',
        hint: 'Try copying the full URL from the email, or open the request in your dashboard.',
        dashboardUrl: baseUrl,
      })
    }

    if (action !== 'approve' && action !== 'reject') {
      return renderPage({
        type: 'error',
        title: 'Invalid Action',
        message: `The action "${action}" is not recognized. Valid actions are "approve" or "reject".`,
        hint: 'Use the original links from the notification email.',
        dashboardUrl: baseUrl,
      })
    }

    // --- Validate token ---
    if (!validateToken(id, action, token)) {
      return renderPage({
        type: 'error',
        title: 'Link Expired or Invalid',
        message: 'This approval link is no longer valid. The security token could not be verified.',
        hint: 'This can happen if the system configuration has changed since the email was sent. Please review the request from your dashboard instead.',
        dashboardUrl: baseUrl,
      })
    }

    // --- Get the request ---
    const [hitlReq] = await db.select().from(hitlRequest).where(eq(hitlRequest.id, id)).limit(1)

    if (!hitlReq) {
      return renderPage({
        type: 'error',
        title: 'Request Not Found',
        message:
          'This approval request no longer exists. It may have been deleted or the workflow was removed.',
        dashboardUrl: baseUrl,
      })
    }

    // Get workflow name for context
    let workflowName = ''
    try {
      const [wf] = await db
        .select({ name: workflow.name })
        .from(workflow)
        .where(eq(workflow.id, hitlReq.workflowId))
        .limit(1)
      if (wf) workflowName = wf.name
    } catch {
      /* ignore */
    }

    const reviewUrl = `${baseUrl}/w/${hitlReq.workflowId}?hitl=${id}`

    // --- Check if already responded ---
    if (hitlReq.status !== 'pending') {
      const statusLabels: Record<string, string> = {
        approved: 'approved',
        rejected: 'rejected',
        timeout: 'expired due to timeout',
        cancelled: 'cancelled',
      }
      const statusLabel = statusLabels[hitlReq.status] || hitlReq.status

      const respondedAt = hitlReq.respondedAt
        ? new Date(hitlReq.respondedAt).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : null

      return renderPage({
        type: 'warning',
        title: 'Already Processed',
        message: `This request has already been ${statusLabel}.`,
        detail: respondedAt ? `Responded on ${respondedAt}` : undefined,
        hint:
          hitlReq.status === 'timeout'
            ? 'The request expired before a response was received. If this action is still needed, please create a new request.'
            : 'Each request can only be responded to once.',
        workflowName,
        reviewUrl,
        dashboardUrl: baseUrl,
      })
    }

    // --- Check timeout ---
    if (hitlReq.timeoutAt && new Date(hitlReq.timeoutAt) < new Date()) {
      // Mark as timed out
      await db
        .update(hitlRequest)
        .set({ status: 'timeout', respondedAt: new Date() })
        .where(eq(hitlRequest.id, id))

      return renderPage({
        type: 'warning',
        title: 'Request Expired',
        message: 'This request has expired and can no longer be acted upon.',
        detail: `The deadline was ${new Date(hitlReq.timeoutAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`,
        hint: 'If this action is still needed, a new approval request should be created from the workflow.',
        workflowName,
        reviewUrl,
        dashboardUrl: baseUrl,
      })
    }

    // --- Process the action ---
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    await db
      .update(hitlRequest)
      .set({
        status: newStatus,
        respondedAt: new Date(),
        responseNote: 'Quick response via email link',
      })
      .where(eq(hitlRequest.id, id))

    logger.info('HITL quick response processed', { requestId: id, action, status: newStatus })

    // --- If rejected, return immediately ---
    if (action === 'reject') {
      return renderPage({
        type: 'rejected',
        title: 'Request Rejected',
        message: `"${hitlReq.title}" has been rejected.`,
        detail: 'The workflow has been notified and will handle the rejection accordingly.',
        workflowName,
        reviewUrl,
        dashboardUrl: baseUrl,
      })
    }

    // --- If approved, trigger workflow resume ---
    let resumeResult: { resumed?: boolean; reason?: string; error?: string } = {}
    try {
      // Use 127.0.0.1 for internal self-calls (avoids DNS + HTTPS redirect issues)
      const port = process.env.PORT || 3000
      const resumeResponse = await fetch(`http://127.0.0.1:${port}/api/hitl/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hitlRequestId: id }),
      })

      const resumeData = await resumeResponse.json()
      resumeResult = {
        resumed: resumeData.resumed,
        reason: resumeData.reason,
        error: resumeData.error,
      }

      logger.info('Workflow resume result', { requestId: id, ...resumeResult })
    } catch (resumeError: any) {
      logger.error('Failed to trigger workflow resume', {
        requestId: id,
        error: resumeError.message,
      })
      resumeResult = { error: resumeError.message }
    }

    // Approved + resumed successfully
    if (resumeResult.resumed) {
      return renderPage({
        type: 'approved',
        title: 'Approved & Running',
        message: `"${hitlReq.title}" has been approved.`,
        detail: 'The workflow has resumed execution and is now continuing from where it paused.',
        workflowName,
        reviewUrl,
        dashboardUrl: baseUrl,
      })
    }

    // Approved but resume had a known reason (not an error)
    if (resumeResult.reason && !resumeResult.error) {
      return renderPage({
        type: 'approved',
        title: 'Request Approved',
        message: `"${hitlReq.title}" has been approved.`,
        detail: resumeResult.reason,
        hint: 'The approval has been recorded. The workflow may need to be manually resumed from the dashboard.',
        workflowName,
        reviewUrl,
        dashboardUrl: baseUrl,
      })
    }

    // Approved but resume failed
    if (resumeResult.error) {
      return renderPage({
        type: 'approved-with-warning',
        title: 'Approved (Workflow Issue)',
        message: `"${hitlReq.title}" has been approved, but the workflow could not be automatically resumed.`,
        detail: `Error: ${resumeResult.error}`,
        hint: 'Your approval has been saved. Please open the workflow in the dashboard to resume it manually.',
        workflowName,
        reviewUrl,
        dashboardUrl: baseUrl,
      })
    }

    // Fallback: approved, unknown resume state
    return renderPage({
      type: 'approved',
      title: 'Request Approved',
      message: `"${hitlReq.title}" has been approved successfully.`,
      workflowName,
      reviewUrl,
      dashboardUrl: baseUrl,
    })
  } catch (error: any) {
    logger.error('Failed to process quick response', { error: error?.message || error })
    return renderPage({
      type: 'error',
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred while processing your response.',
      hint: 'Please try again, or review the request from your dashboard. If this keeps happening, contact your system administrator.',
      dashboardUrl: baseUrl,
    })
  }
}

// --- HTML Page Renderer ---

interface PageOptions {
  type: 'approved' | 'approved-with-warning' | 'rejected' | 'warning' | 'error'
  title: string
  message: string
  detail?: string
  hint?: string
  workflowName?: string
  reviewUrl?: string
  dashboardUrl: string
}

function renderPage(opts: PageOptions): NextResponse {
  const brandName = process.env.EMAIL_BRAND_NAME || 'NowFlow'
  const brandUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const logoUrl = process.env.EMAIL_BRAND_LOGO_URL || `${brandUrl}/static/nowflow-logo-email.png`

  const themes = {
    approved: {
      accent: '#4A7A68',
      accentLight: '#f0faf6',
      accentBorder: '#d1ebe0',
      accentGradient: 'linear-gradient(135deg, #5B7B6F, #4A7A68, #6B8F80)',
      iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A7A68" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      badgeText: 'Approved',
    },
    'approved-with-warning': {
      accent: '#d97706',
      accentLight: '#fffbeb',
      accentBorder: '#fde68a',
      accentGradient: 'linear-gradient(135deg, #d97706, #fbbf24)',
      iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      badgeText: 'Approved with Issue',
    },
    rejected: {
      accent: '#71717a',
      accentLight: '#fafafa',
      accentBorder: '#e4e4e7',
      accentGradient: 'linear-gradient(135deg, #71717a, #a1a1aa)',
      iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      badgeText: 'Rejected',
    },
    warning: {
      accent: '#d97706',
      accentLight: '#fffbeb',
      accentBorder: '#fde68a',
      accentGradient: 'linear-gradient(135deg, #d97706, #fbbf24)',
      iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      badgeText: 'Notice',
    },
    error: {
      accent: '#dc2626',
      accentLight: '#fef2f2',
      accentBorder: '#fecaca',
      accentGradient: 'linear-gradient(135deg, #dc2626, #f87171)',
      iconSvg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      badgeText: 'Error',
    },
  }

  const theme = themes[opts.type]

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title} - ${brandName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fafafa;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      position: relative;
      overflow: hidden;
    }

    /* Subtle ambient orbs matching landing page */
    body::before {
      content: '';
      position: fixed;
      top: -200px;
      left: 10%;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, #4A7A68, transparent 65%);
      opacity: 0.05;
      pointer-events: none;
      filter: blur(60px);
    }
    body::after {
      content: '';
      position: fixed;
      bottom: -100px;
      right: 5%;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, #3B82F6, transparent 65%);
      opacity: 0.03;
      pointer-events: none;
      filter: blur(60px);
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.85); }
      to { opacity: 1; transform: scale(1); }
    }

    .wrapper {
      max-width: 440px;
      width: 100%;
      animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      position: relative;
      z-index: 1;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 28px;
    }
    .brand img {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: rgba(255,255,255,0.6);
      border: 1px solid rgba(0,0,0,0.04);
    }
    .brand-name {
      font-size: 17px;
      font-weight: 500;
      color: #27272a;
      letter-spacing: -0.03em;
    }

    .card {
      background: #fff;
      border-radius: 20px;
      border: 1px solid rgba(0,0,0,0.06);
      box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 8px 32px rgba(0,0,0,0.05);
      overflow: hidden;
    }

    .accent-bar {
      height: 3px;
      background: ${theme.accentGradient};
    }

    .status-area {
      padding: 40px 32px 20px;
      text-align: center;
    }
    .status-icon {
      width: 56px; height: 56px;
      border-radius: 16px;
      background: ${theme.accentLight};
      border: 1px solid ${theme.accentBorder};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 100px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${theme.accent};
      background: ${theme.accentLight};
      border: 1px solid ${theme.accentBorder};
    }

    .content {
      padding: 0 32px 28px;
    }
    .content h1 {
      font-size: 24px;
      font-weight: 300;
      color: #27272a;
      line-height: 1.2;
      margin-bottom: 10px;
      letter-spacing: -0.03em;
      text-align: center;
    }
    .content .message {
      font-size: 15px;
      color: #a1a1aa;
      line-height: 1.65;
      text-align: center;
      font-weight: 400;
    }

    .detail-box {
      background: #fafafa;
      border: 1px solid rgba(0,0,0,0.05);
      border-radius: 12px;
      padding: 14px 16px;
      margin: 16px 0 0;
    }
    .detail-box p {
      font-size: 13px;
      color: #71717a;
      line-height: 1.6;
      margin: 0;
    }

    .hint {
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.6;
      margin-top: 12px;
      text-align: center;
    }

    .meta {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(0,0,0,0.05);
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
    }
    .meta-label {
      font-size: 10px;
      color: #a1a1aa;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .meta-value {
      font-size: 12px;
      color: #71717a;
      font-weight: 500;
    }

    .actions {
      padding: 0 32px 28px;
      display: flex;
      gap: 10px;
    }
    .btn {
      flex: 1;
      display: block;
      padding: 13px 20px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
      transition: all 0.2s ease;
      letter-spacing: 0.02em;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .btn-primary {
      background: #27272a;
      color: #fff;
    }
    .btn-primary:hover {
      background: #3f3f46;
    }
    .btn-secondary {
      background: #fafafa;
      color: #71717a;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .btn-secondary:hover {
      background: #f4f4f5;
      border-color: rgba(0,0,0,0.12);
    }

    .footer {
      padding: 20px 32px;
      border-top: 1px solid rgba(0,0,0,0.05);
      text-align: center;
    }
    .footer p {
      font-size: 12px;
      color: #d4d4d8;
      margin: 0;
    }
    .footer a {
      color: #a1a1aa;
      text-decoration: none;
      font-weight: 500;
      letter-spacing: -0.03em;
    }

    @media (max-width: 480px) {
      .wrapper { max-width: 100%; }
      .status-area { padding: 28px 24px 16px; }
      .content { padding: 0 24px 24px; }
      .actions { padding: 0 24px 24px; flex-direction: column; }
      .footer { padding: 16px 24px; }
      .content h1 { font-size: 20px; }
    }

    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; }
      body::before { opacity: 0.03; }
      body::after { opacity: 0.02; }
      .brand-name { color: #f1f5f9; }
      .card { background: #1e293b; border-color: rgba(255,255,255,0.06); }
      .content h1 { color: #f1f5f9; }
      .content .message { color: #94a3b8; }
      .detail-box { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
      .detail-box p { color: #94a3b8; }
      .hint { color: #64748b; }
      .meta { border-color: rgba(255,255,255,0.06); }
      .meta-label { color: #64748b; }
      .meta-value { color: #94a3b8; }
      .btn-primary { background: #f1f5f9; color: #0f172a; }
      .btn-primary:hover { background: #e2e8f0; }
      .btn-secondary { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); color: #94a3b8; }
      .btn-secondary:hover { background: rgba(255,255,255,0.06); }
      .footer { border-color: rgba(255,255,255,0.06); }
      .footer p, .footer a { color: #64748b; }
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="brand">
      <img src="${logoUrl}" alt="${brandName}">
      <span class="brand-name">${brandName}</span>
    </div>

    <div class="card">
      <div class="accent-bar"></div>

      <div class="status-area">
        <div class="status-icon">
          ${theme.iconSvg}
        </div>
        <span class="status-badge">${theme.badgeText}</span>
      </div>

      <div class="content">
        <h1>${opts.title}</h1>
        <p class="message">${opts.message}</p>

        ${
          opts.detail
            ? `
        <div class="detail-box">
          <p>${opts.detail}</p>
        </div>
        `
            : ''
        }

        ${opts.hint ? `<p class="hint">${opts.hint}</p>` : ''}

        ${
          opts.workflowName
            ? `
        <div class="meta">
          <div class="meta-row">
            <span class="meta-label">Workflow</span>
            <span class="meta-value">${opts.workflowName}</span>
          </div>
        </div>
        `
            : ''
        }
      </div>

      <div class="actions">
        ${opts.reviewUrl ? `<a href="${opts.reviewUrl}" class="btn btn-primary">View in Dashboard</a>` : ''}
        <a href="${opts.dashboardUrl}" class="btn ${opts.reviewUrl ? 'btn-secondary' : 'btn-primary'}">${opts.reviewUrl ? 'Home' : 'Go to Dashboard'}</a>
      </div>

      <div class="footer">
        <p><a href="${brandUrl}">${brandName}</a></p>
      </div>

    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/**
 * Generate approval/rejection tokens for a HITL request.
 * Uses the same secret fallback chain as validateToken.
 */
export function generateHITLTokens(requestId: string): {
  approveToken: string
  rejectToken: string
} {
  const secret = getTokenSecret()
  if (!secret)
    throw new Error('HITL_TOKEN_SECRET, BETTER_AUTH_SECRET or AUTH_SECRET must be configured')
  return {
    approveToken: generateTokenHash(requestId, 'approve', secret),
    rejectToken: generateTokenHash(requestId, 'reject', secret),
  }
}
