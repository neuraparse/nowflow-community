import { eq } from 'drizzle-orm'
import {
  getEmailSubject,
  renderAccountWelcomeEmail,
  renderInvitationEmail,
  renderOTPEmail,
  renderPasswordResetEmail,
  renderWaitlistApprovalEmail,
  renderWaitlistConfirmationEmail,
} from '@/components/emails/render-email'
import { SENDER_NAME } from '@/lib/config/app-urls'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { emailTemplate as emailTemplateTable } from '@/db/schema'
import { blocksToHtml, blocksToTemplateSource, normalizeBlocks } from './blocks'
import type { EmailTemplateFormat, EmailTemplateId } from './registry'
import { getEmailTemplateDefinition } from './registry'
import {
  escapeHtml,
  renderBodyToHtml,
  renderTemplateString,
  sanitizeEmailHeaderValue,
  templateContainsToken,
  wrapBrandedEmail,
} from './render'

const logger = createLogger('EmailTemplates')

export interface EmailTemplateRecord {
  id: EmailTemplateId
  enabled: boolean
  format: EmailTemplateFormat
  editor?: 'raw' | 'builder'
  subject: string
  body: string
  blocks?: unknown
  updatedBy: string | null
  updatedAt: Date
  createdAt: Date
}

export interface EmailTemplateEffective {
  id: EmailTemplateId
  enabled: boolean
  format: EmailTemplateFormat
  subjectTemplate: string
  bodyTemplate: string
  source: 'default' | 'override'
}

export async function getEmailTemplateOverride(
  id: EmailTemplateId
): Promise<EmailTemplateRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(emailTemplateTable)
      .where(eq(emailTemplateTable.id, id))
      .limit(1)
    return (row as any) || null
  } catch (error) {
    logger.warn('Failed to read email_template (falling back to defaults)', { id, error })
    return null
  }
}

export async function upsertEmailTemplateOverride(input: {
  id: EmailTemplateId
  enabled: boolean
  format: EmailTemplateFormat
  editor?: 'raw' | 'builder'
  subject: string
  body: string
  blocks?: unknown
  updatedBy: string
}): Promise<void> {
  const now = new Date()
  await db
    .insert(emailTemplateTable)
    .values({
      id: input.id,
      enabled: input.enabled,
      format: input.format,
      editor: input.editor ?? 'raw',
      subject: input.subject,
      body: input.body,
      blocks: input.blocks ?? null,
      updatedBy: input.updatedBy,
      updatedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: emailTemplateTable.id,
      set: {
        enabled: input.enabled,
        format: input.format,
        editor: input.editor ?? 'raw',
        subject: input.subject,
        body: input.body,
        blocks: input.blocks ?? null,
        updatedBy: input.updatedBy,
        updatedAt: now,
      },
    })
}

export async function getEffectiveEmailTemplate(
  id: EmailTemplateId
): Promise<EmailTemplateEffective> {
  const override = await getEmailTemplateOverride(id)
  if (override && override.enabled) {
    return {
      id,
      enabled: true,
      format: override.format as EmailTemplateFormat,
      subjectTemplate: override.subject,
      bodyTemplate: override.body,
      source: 'override',
    }
  }

  return {
    id,
    enabled: false,
    format: 'html',
    subjectTemplate: getEmailSubject(id),
    bodyTemplate: '',
    source: 'default',
  }
}

function assertRequiredTokens(id: EmailTemplateId, subject: string, body: string) {
  const def = getEmailTemplateDefinition(id)
  const missing = def.requiredTokens.filter(
    (token) => !templateContainsToken(subject, token) && !templateContainsToken(body, token)
  )
  if (missing.length > 0) {
    throw new Error(`Missing required token(s): ${missing.join(', ')}`)
  }
}

export async function renderEmail(
  id: EmailTemplateId,
  data: Record<string, unknown>,
  options?: { forceDefault?: boolean }
): Promise<{ subject: string; html: string; source: 'default' | 'override' }> {
  const override = options?.forceDefault ? null : await getEmailTemplateOverride(id)
  if (override && override.enabled) {
    const subject = sanitizeEmailHeaderValue(renderTemplateString(override.subject, data, 'text'))

    const editor = (override as any).editor as 'raw' | 'builder' | undefined
    const blocks = normalizeBlocks((override as any).blocks)

    if (editor === 'builder' && blocks.length > 0) {
      assertRequiredTokens(id, override.subject, blocksToTemplateSource(blocks))
      const html = wrapBrandedEmail(
        blocksToHtml(blocks, (t) => renderTemplateString(t, data, 'html'), escapeHtml)
      )
      return { subject, html, source: 'override' }
    }

    assertRequiredTokens(id, override.subject, override.body)
    const html = renderBodyToHtml(override.format as EmailTemplateFormat, override.body, data)

    return { subject, html, source: 'override' }
  }

  switch (id) {
    case 'sign-in':
    case 'email-verification':
    case 'forget-password': {
      const otp = String(data.otp ?? '')
      const email = String(data.email ?? '')
      const html = await renderOTPEmail(otp, email, id)
      return { subject: getEmailSubject(id), html, source: 'default' }
    }
    case 'chat-access': {
      const otp = String(data.otp ?? '')
      const email = String(data.email ?? '')
      const chatTitle = typeof data.chatTitle === 'string' ? data.chatTitle : undefined
      const html = await renderOTPEmail(otp, email, 'chat-access', chatTitle)
      const subject = chatTitle
        ? `Verification code for ${chatTitle}`
        : getEmailSubject('chat-access')
      return { subject, html, source: 'default' }
    }
    case 'reset-password': {
      const username = String(data.username ?? '')
      const resetLink = String(data.resetLink ?? '')
      const html = await renderPasswordResetEmail(username, resetLink)
      return { subject: getEmailSubject(id), html, source: 'default' }
    }
    case 'waitlist-confirmation': {
      const email = String(data.email ?? '')
      const html = await renderWaitlistConfirmationEmail(email)
      return { subject: getEmailSubject(id), html, source: 'default' }
    }
    case 'waitlist-approval': {
      const email = String(data.email ?? '')
      const signupLink = String(data.signupLink ?? '')
      const html = await renderWaitlistApprovalEmail(email, signupLink)
      return { subject: getEmailSubject(id), html, source: 'default' }
    }
    case 'invitation': {
      const inviterName = String(data.inviterName ?? '')
      const organizationName = String(data.organizationName ?? '')
      const inviteLink = String(data.inviteLink ?? '')
      const invitedEmail = String(data.invitedEmail ?? '')
      const html = await renderInvitationEmail(
        inviterName,
        organizationName,
        inviteLink,
        invitedEmail
      )
      const subject =
        inviterName && organizationName
          ? `${inviterName} has invited you to join ${organizationName} on ${SENDER_NAME}`
          : getEmailSubject(id)
      return { subject, html, source: 'default' }
    }
    case 'account-welcome': {
      const name = String(data.name ?? '')
      const email = String(data.email ?? '')
      const password = typeof data.password === 'string' ? data.password : undefined
      const loginUrl = typeof data.loginUrl === 'string' ? data.loginUrl : undefined
      const html = await renderAccountWelcomeEmail(name, email, password, loginUrl)
      return { subject: getEmailSubject(id), html, source: 'default' }
    }
    default:
      return { subject: getEmailSubject(id), html: '', source: 'default' }
  }
}

export async function listEmailTemplateOverrides(): Promise<EmailTemplateRecord[]> {
  try {
    const rows = await db.select().from(emailTemplateTable)
    return rows as any
  } catch (error) {
    logger.warn('Failed to list email_template (falling back to defaults)', { error })
    return []
  }
}
