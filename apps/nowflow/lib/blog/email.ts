import { marked } from 'marked'
import { resolveAudienceEmailBatch } from '@/lib/audiences/service'
import { APP_DOMAIN } from '@/lib/config/app-urls'
import { escapeHtml, sanitizeHtmlForEmail, wrapBrandedEmail } from '@/lib/email-templates/render'
import { createLogger } from '@/lib/logs/console-logger'
import { sendBatchEmails } from '@/lib/mailer'

const logger = createLogger('BlogEmail')

export type BlogEmailPayload = {
  title: string
  slug: string
  excerpt: string | null
  content: string
  coverImage: string | null
  coverImageAlt: string | null
  readingTime: number
  publishedAt: Date | null
  emailSubject: string | null
}

export type BlogEmailSendResult = {
  success: boolean
  successCount: number
  failureCount: number
  errors: string[]
}

function formatDate(value: Date | null) {
  if (!value) return ''
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const markdownRenderer = new marked.Renderer()
markdownRenderer.html = ({ text }: { text: string }) => escapeHtml(text)

function renderMarkdownToHtml(markdown: string) {
  if (!markdown) return ''
  return marked.parse(markdown, {
    gfm: true,
    breaks: false,
    renderer: markdownRenderer,
  }) as string
}

export function renderBlogEmailBody(payload: BlogEmailPayload): { subject: string; html: string } {
  const baseUrl = APP_DOMAIN
  const postUrl = `${baseUrl}/blog/${payload.slug}`
  const subject = payload.emailSubject?.trim() || `New on NowFlow: ${payload.title}`
  const meta = [formatDate(payload.publishedAt), `${payload.readingTime} min read`]
    .filter(Boolean)
    .join(' • ')

  const contentHtml = renderMarkdownToHtml(payload.content)
  const summaryHtml = payload.excerpt
    ? `<p style="font-size:15px;line-height:1.7;color:#1f2937;margin:0 0 18px 0;">${escapeHtml(
        payload.excerpt
      )}</p>`
    : ''
  const heroHtml = payload.coverImage
    ? `<div style="margin:0 0 18px 0;"><img src="${escapeHtml(
        payload.coverImage
      )}" alt="${escapeHtml(payload.coverImageAlt || payload.title)}" style="width:100%;height:auto;border-radius:16px;object-fit:cover;" /></div>`
    : ''

  const body = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:#0f172a;">`,
    `<div style="font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:12px;">NowFlow Blog</div>`,
    `<h1 style="font-size:26px;line-height:1.3;margin:0 0 12px 0;color:#0f172a;">${escapeHtml(
      payload.title
    )}</h1>`,
    meta
      ? `<div style="font-size:13px;color:#64748b;margin-bottom:18px;">${escapeHtml(meta)}</div>`
      : '',
    heroHtml,
    summaryHtml,
    `<div style="font-size:15px;line-height:1.8;color:#111827;">${contentHtml}</div>`,
    `<div style="margin-top:24px;">`,
    `<a href="${escapeHtml(
      postUrl
    )}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px;">Read on NowFlow</a>`,
    `</div>`,
    `<div style="margin-top:32px;font-size:12px;line-height:1.6;color:#94a3b8;">You are receiving this email because you have an active NowFlow account.</div>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('')

  const html = wrapBrandedEmail(sanitizeHtmlForEmail(body))
  return { subject, html }
}

export async function sendBlogPublicationEmail(
  payload: BlogEmailPayload,
  options?: { onlyVerified?: boolean; audienceId?: string | null; includeContacts?: boolean }
): Promise<BlogEmailSendResult> {
  const { subject, html } = renderBlogEmailBody(payload)
  const batchSize = Number(process.env.BLOG_EMAIL_BATCH_SIZE || '200')
  const maxRecipients = Number(process.env.BLOG_EMAIL_MAX_RECIPIENTS || '0')
  const onlyVerified = options?.onlyVerified ?? true
  const audienceId = options?.audienceId ?? null
  const includeContacts = options?.includeContacts ?? true

  let offset = 0
  let processed = 0
  let successCount = 0
  let failureCount = 0
  const errors: string[] = []

  while (true) {
    if (maxRecipients && processed >= maxRecipients) break
    const limit = maxRecipients ? Math.min(batchSize, maxRecipients - processed) : batchSize
    const recipients: string[] = (
      await resolveAudienceEmailBatch({
        audienceId,
        limit,
        offset,
        onlyVerified,
        includeContacts,
      })
    ).recipients
    if (recipients.length === 0) break

    const result = await sendBatchEmails({
      emails: recipients.map((to) => ({ to, subject, html })),
    })
    const sent = result.results.filter((item) => item.success).length
    successCount += sent
    failureCount += result.results.length - sent
    const failed = result.results.filter((item) => !item.success).map((item) => item.message)
    if (failed.length) {
      errors.push(...failed)
    }

    processed += recipients.length
    offset += limit

    if (recipients.length < limit) break
  }

  if (processed === 0) {
    errors.push('No recipients found for the selected audience.')
  }

  logger.info('Blog publication email results', {
    subject,
    successCount,
    failureCount,
    errors: errors.slice(0, 5),
  })

  return {
    success: processed > 0 && failureCount === 0,
    successCount,
    failureCount,
    errors: errors.slice(0, 50),
  }
}
