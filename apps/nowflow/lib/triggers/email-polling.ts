import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { workflowTrigger } from '@/db/schema'

const logger = createLogger('EmailPolling')

// Max number of seen message IDs to retain for deduplication.
// 500 covers ~50 polls at 10 messages each - prevents reprocessing after restart.
const MAX_SEEN_IDS = 500

export interface EmailTriggerConfig {
  provider: 'gmail' | 'outlook' | 'imap'
  credentialId: string
  folder: string
  filter?: string
  imapHost?: string
  imapPort?: number
  imapUser?: string
  imapPass?: string
  imapTls?: boolean
}

export interface EmailMessage {
  messageId: string
  from: { name: string; email: string }
  to: Array<{ name: string; email: string }>
  cc?: Array<{ name: string; email: string }>
  subject: string
  body: string
  htmlBody?: string
  date: string
  attachments?: Array<{ filename: string; mimeType: string; size: number }>
  labels?: string[]
  folder: string
  provider: 'gmail' | 'outlook' | 'imap'
  isRead: boolean
  hasAttachments: boolean
}

// ============================================
// Gmail Helpers
// ============================================

function parseEmailAddress(header: string): { name: string; email: string } {
  const match = header.match(/^(.+?)\s*<(.+?)>$/)
  if (match) {
    return { name: match[1].replace(/^["']|["']$/g, '').trim(), email: match[2].trim() }
  }
  return { name: '', email: header.trim() }
}

function getGmailHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function extractGmailBody(payload: any): { text: string; html: string } {
  let text = ''
  let html = ''

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data)
    if (payload.mimeType === 'text/html') {
      html = decoded
    } else {
      text = decoded
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data && !text) {
        text = decodeBase64Url(part.body.data)
      } else if (part.mimeType === 'text/html' && part.body?.data && !html) {
        html = decodeBase64Url(part.body.data)
      } else if (part.mimeType?.startsWith('multipart/')) {
        const nested = extractGmailBody(part)
        if (!text && nested.text) text = nested.text
        if (!html && nested.html) html = nested.html
      }
    }
  }

  return { text, html }
}

function extractGmailAttachments(
  payload: any
): Array<{ filename: string; mimeType: string; size: number }> {
  const attachments: Array<{ filename: string; mimeType: string; size: number }> = []

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body?.size || 0,
        })
      }
      if (part.parts) {
        attachments.push(...extractGmailAttachments(part))
      }
    }
  }

  return attachments
}

// ============================================
// Gmail Polling - only unread since last poll
// ============================================

export async function executeGmailPolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: EmailMessage[] }> {
  const config = trigger.config as EmailTriggerConfig
  const requestId = crypto.randomUUID().slice(0, 8)

  logger.info(`[${requestId}] Gmail polling for trigger ${trigger.id}`)

  let accessToken: string | null = null
  try {
    accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
  } catch (authError) {
    const msg = authError instanceof Error ? authError.message : String(authError)
    logger.error(`[${requestId}] Gmail OAuth error`, {
      error: msg,
      credentialId: config.credentialId,
    })
    throw new Error(
      `Gmail authentication failed: ${msg}. ` +
        'Please reconnect your Gmail account with the required scopes (gmail.readonly, gmail.modify).'
    )
  }

  if (!accessToken) {
    throw new Error(
      'Failed to get Gmail access token. ' +
        'Please reconnect your Gmail account and ensure gmail.readonly and gmail.modify scopes are granted.'
    )
  }

  // Query: mails received after last poll = trigger emails
  let query = ''

  if (trigger.lastPolledAt) {
    const afterEpoch = Math.floor(new Date(trigger.lastPolledAt).getTime() / 1000)
    query = `after:${afterEpoch}`
  }

  if (config.folder && config.folder.toUpperCase() !== 'INBOX') {
    query += ` label:${config.folder}`
  }

  if (config.filter) {
    query += ` ${config.filter}`
  }

  query = query.trim()

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  if (query) {
    listUrl.searchParams.set('q', query)
  }
  listUrl.searchParams.set('maxResults', '10')

  const listResponse = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!listResponse.ok) {
    const errorText = await listResponse.text()
    // Provide actionable error messages for common OAuth/scope issues
    if (listResponse.status === 401 || listResponse.status === 403) {
      throw new Error(
        `Gmail API authorization failed (${listResponse.status}). ` +
          'Your access token may be expired or missing required scopes. ' +
          'Please reconnect your Gmail account with gmail.readonly and gmail.modify scopes.'
      )
    }
    throw new Error(`Gmail API error (${listResponse.status}): ${errorText}`)
  }

  const listData = await listResponse.json()
  const messageRefs = listData.messages || []

  if (messageRefs.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Safety dedup - skip already processed messages
  const lastSeenIds = (trigger.lastSeenIdentifiers as string[]) || []
  const newRefs = messageRefs.filter((m: { id: string }) => !lastSeenIds.includes(m.id))

  if (newRefs.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Fetch full details for each new unread message
  const emails: EmailMessage[] = []

  for (const msgRef of newRefs) {
    try {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!msgResponse.ok) continue

      const msgData = await msgResponse.json()
      const headers = msgData.payload?.headers || []
      const { text, html } = extractGmailBody(msgData.payload)
      const attachments = extractGmailAttachments(msgData.payload)

      emails.push({
        messageId: msgData.id,
        from: parseEmailAddress(getGmailHeader(headers, 'From')),
        to: getGmailHeader(headers, 'To')
          .split(',')
          .map((a: string) => parseEmailAddress(a.trim()))
          .filter((a: { email: string }) => a.email),
        cc: getGmailHeader(headers, 'Cc')
          ? getGmailHeader(headers, 'Cc')
              .split(',')
              .map((a: string) => parseEmailAddress(a.trim()))
              .filter((a: { email: string }) => a.email)
          : undefined,
        subject: getGmailHeader(headers, 'Subject'),
        body: text || html?.replace(/<[^>]*>/g, '') || '',
        htmlBody: html || undefined,
        date: getGmailHeader(headers, 'Date'),
        attachments: attachments.length > 0 ? attachments : undefined,
        labels: msgData.labelIds,
        folder: config.folder || 'INBOX',
        provider: 'gmail',
        isRead: false,
        hasAttachments: attachments.length > 0,
      })
    } catch (error) {
      logger.error(`[${requestId}] Error fetching Gmail message ${msgRef.id}`, error)
    }
  }

  if (emails.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Mark all as seen - keep larger window to prevent reprocessing after restarts
  const newIds = emails.map((m) => m.messageId)
  await db
    .update(workflowTrigger)
    .set({
      lastSeenIdentifiers: [...newIds, ...lastSeenIds].slice(0, MAX_SEEN_IDS),
      lastPolledAt: new Date(),
    })
    .where(eq(workflowTrigger.id, trigger.id))

  logger.info(`[${requestId}] ${emails.length} new unread Gmail messages`)
  return { hasNewData: true, newData: emails }
}

// ============================================
// Outlook Helpers
// ============================================

function parseOutlookAddress(addr: any): { name: string; email: string } {
  if (!addr) return { name: '', email: '' }
  return {
    name: addr.emailAddress?.name || '',
    email: addr.emailAddress?.address || '',
  }
}

// ============================================
// Outlook Polling - only unread since last poll
// ============================================

export async function executeOutlookPolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: EmailMessage[] }> {
  const config = trigger.config as EmailTriggerConfig
  const requestId = crypto.randomUUID().slice(0, 8)

  logger.info(`[${requestId}] Outlook polling for trigger ${trigger.id}`)

  let accessToken: string | null = null
  try {
    accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
  } catch (authError) {
    const msg = authError instanceof Error ? authError.message : String(authError)
    logger.error(`[${requestId}] Outlook OAuth error`, {
      error: msg,
      credentialId: config.credentialId,
    })
    throw new Error(
      `Outlook authentication failed: ${msg}. Please reconnect your Microsoft account.`
    )
  }

  if (!accessToken) {
    throw new Error('Failed to get Outlook access token. Please reconnect your Microsoft account.')
  }

  const folder = config.folder || 'Inbox'
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages`

  // Filter: mails received after last poll = trigger emails
  const filters: string[] = []

  if (trigger.lastPolledAt) {
    filters.push(`receivedDateTime ge ${new Date(trigger.lastPolledAt).toISOString()}`)
  }

  const params = new URLSearchParams()
  if (filters.length > 0) {
    params.set('$filter', filters.join(' and '))
  }
  params.set('$orderby', 'receivedDateTime desc')
  params.set('$top', '10')
  params.set(
    '$select',
    'id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,hasAttachments,isRead'
  )

  url += `?${params.toString()}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Outlook API authorization failed (${response.status}). ` +
          'Your access token may be expired or missing required permissions. ' +
          'Please reconnect your Microsoft account.'
      )
    }
    throw new Error(`Microsoft Graph API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const messages = data.value || []

  if (messages.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Safety dedup - skip already processed messages
  const lastSeenIds = (trigger.lastSeenIdentifiers as string[]) || []
  let newMessages = messages.filter((m: any) => !lastSeenIds.includes(m.id))

  if (newMessages.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Apply user filter if specified (from:, subject:, keyword)
  if (config.filter) {
    const filterParts = config.filter.toLowerCase().split(/\s+/)
    newMessages = newMessages.filter((msg: any) => {
      const subject = (msg.subject || '').toLowerCase()
      const fromEmail = (msg.from?.emailAddress?.address || '').toLowerCase()
      const fromName = (msg.from?.emailAddress?.name || '').toLowerCase()

      return filterParts.every((part: string) => {
        if (part.startsWith('from:')) {
          const v = part.slice(5)
          return fromEmail.includes(v) || fromName.includes(v)
        }
        if (part.startsWith('subject:')) {
          return subject.includes(part.slice(8))
        }
        return subject.includes(part) || fromEmail.includes(part)
      })
    })
  }

  if (newMessages.length === 0) {
    // Mark filtered-out messages as seen
    const allIds = messages.map((m: any) => m.id)
    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: [...allIds, ...lastSeenIds].slice(0, MAX_SEEN_IDS),
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Convert to EmailMessage format - these are the trigger emails
  const emails: EmailMessage[] = newMessages.map((msg: any) => ({
    messageId: msg.id,
    from: parseOutlookAddress(msg.from),
    to: (msg.toRecipients || []).map(parseOutlookAddress),
    cc: msg.ccRecipients?.length > 0 ? msg.ccRecipients.map(parseOutlookAddress) : undefined,
    subject: msg.subject || '',
    body:
      msg.body?.contentType === 'html'
        ? (msg.body?.content || '').replace(/<[^>]*>/g, '')
        : msg.body?.content || '',
    htmlBody: msg.body?.contentType === 'html' ? msg.body?.content : undefined,
    date: msg.receivedDateTime || '',
    attachments: undefined,
    folder: config.folder || 'Inbox',
    provider: 'outlook' as const,
    isRead: false,
    hasAttachments: msg.hasAttachments ?? false,
  }))

  // Mark all as seen
  const allIds = messages.map((m: any) => m.id)
  await db
    .update(workflowTrigger)
    .set({
      lastSeenIdentifiers: [...allIds, ...lastSeenIds].slice(0, MAX_SEEN_IDS),
      lastPolledAt: new Date(),
    })
    .where(eq(workflowTrigger.id, trigger.id))

  logger.info(`[${requestId}] ${emails.length} new unread Outlook messages`)
  return { hasNewData: true, newData: emails }
}

// ============================================
// Router
// ============================================

export async function executeEmailPolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: any }> {
  const config = trigger.config as EmailTriggerConfig

  switch (config.provider) {
    case 'gmail':
      return executeGmailPolling(trigger, userId)
    case 'outlook':
      return executeOutlookPolling(trigger, userId)
    case 'imap':
      throw new Error('IMAP polling is not yet implemented. Please use Gmail or Outlook.')
    default:
      throw new Error(`Unknown email provider: ${config.provider}`)
  }
}
