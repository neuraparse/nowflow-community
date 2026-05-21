import { NextRequest, NextResponse } from 'next/server'
import { APP_DOMAIN } from '@/lib/config/app-urls'
import { UnsubscribeCategory, verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { createLogger } from '@/lib/logs/console-logger'
import { updatePreferences } from '@/lib/notifications/notification-service'

const logger = createLogger('EmailUnsubscribe')

/**
 * POST /api/email/unsubscribe
 * RFC 8058 one-click unsubscribe handler (called by Gmail/email clients).
 * Accepts form-encoded body with List-Unsubscribe=One-Click or token as query param.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const result = verifyUnsubscribeToken(token)
    if (!result) {
      logger.warn('Invalid unsubscribe token received')
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    const { userId, category } = result

    const preferencesUpdate = buildPreferencesUpdate(category)
    await updatePreferences(userId, preferencesUpdate)

    logger.info('User unsubscribed via one-click', { userId, category })

    return NextResponse.json({ success: true, message: 'Unsubscribed successfully' })
  } catch (error) {
    logger.error('Unsubscribe error:', error)
    return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 })
  }
}

/**
 * GET /api/email/unsubscribe
 * Browser-accessible unsubscribe page - shows confirmation and redirects to settings.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return redirectToSettings()
    }

    const result = verifyUnsubscribeToken(token)
    if (!result) {
      return new NextResponse(
        renderPage('Invalid Link', 'This unsubscribe link is invalid or has expired.'),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      )
    }

    const { userId, category } = result

    const preferencesUpdate = buildPreferencesUpdate(category)
    await updatePreferences(userId, preferencesUpdate)

    logger.info('User unsubscribed via browser', { userId, category })

    const categoryLabel = getCategoryLabel(category)
    return new NextResponse(
      renderPage(
        'Unsubscribed',
        `You have been unsubscribed from <strong>${categoryLabel}</strong> notifications. ` +
          `You can manage all notification preferences in your <a href="${APP_DOMAIN}/settings">account settings</a>.`
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (error) {
    logger.error('Unsubscribe GET error:', error)
    return redirectToSettings()
  }
}

function buildPreferencesUpdate(category: UnsubscribeCategory) {
  switch (category) {
    case 'workflowCompletion':
      return { workflowCompletion: false }
    case 'workflowFailure':
      return { workflowFailure: false }
    case 'digest':
      return { digestEnabled: false }
    case 'all':
      return { workflowCompletion: false, workflowFailure: false, digestEnabled: false }
  }
}

function getCategoryLabel(category: UnsubscribeCategory): string {
  switch (category) {
    case 'workflowCompletion':
      return 'workflow completion'
    case 'workflowFailure':
      return 'workflow failure'
    case 'digest':
      return 'digest'
    case 'all':
      return 'all'
  }
}

function redirectToSettings() {
  return NextResponse.redirect(`${APP_DOMAIN}/settings`, { status: 302 })
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - NowFlow</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fafafa; color: #27272a; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #71717a; line-height: 1.6; margin: 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
}
