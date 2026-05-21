import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { NOREPLY_EMAIL, SENDER_NAME, SUPPORT_EMAIL } from '@/lib/config/app-urls'
import { createLogger } from '@/lib/logs/console-logger'
import { canSendEmailTo } from '@/lib/spam-guard'

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
  attachments?: EmailAttachment[]
  headers?: Record<string, string>
}

interface BatchEmailOptions {
  emails: EmailOptions[]
}

interface SendEmailResult {
  success: boolean
  message: string
  data?: any
}

interface BatchSendEmailResult {
  success: boolean
  message: string
  results: SendEmailResult[]
  data?: any
}

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
  cid?: string
}

const logger = createLogger('Mailer')

// SMTP Configuration
const smtpConfig = {
  host: process.env.SMTP_HOST || 'mail',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  tls: {
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
  ignoreTLS: process.env.SMTP_IGNORE_TLS === 'true',
  requireTLS: false,
}

// Create nodemailer transporter for SMTP
const smtpTransporter = nodemailer.createTransport(smtpConfig)

// Fallback to Resend if SMTP is not configured
const resendApiKey = process.env.RESEND_API_KEY
const resend =
  resendApiKey && resendApiKey !== 'placeholder' && resendApiKey.trim() !== ''
    ? new Resend(resendApiKey)
    : null

// Determine which mail service to use (prefer SMTP)
const useSmtp = process.env.USE_SMTP !== 'false'

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  attachments,
  headers,
}: EmailOptions): Promise<SendEmailResult> {
  try {
    // Rate limit check - prevent flooding any single recipient
    if (!(await canSendEmailTo(to))) {
      logger.warn('Email rate-limited:', { to, subject })
      return {
        success: false,
        message: `Email to ${to} rate-limited - too many emails sent recently`,
      }
    }

    const senderEmail = from || NOREPLY_EMAIL

    // Use SMTP if configured and enabled
    if (useSmtp) {
      try {
        const info = await smtpTransporter.sendMail({
          from: `${SENDER_NAME} <${senderEmail}>`,
          to,
          subject,
          html,
          replyTo: replyTo || SUPPORT_EMAIL,
          attachments,
          headers,
        })

        logger.info('Email sent via SMTP:', {
          messageId: info.messageId,
          to,
          subject,
        })

        return {
          success: true,
          message: 'Email sent successfully via SMTP',
          data: { id: info.messageId, response: info.response },
        }
      } catch (smtpError) {
        logger.error('SMTP error, falling back to Resend:', smtpError)
        // Fall through to Resend fallback
      }
    }

    // Fallback to Resend
    if (!resend) {
      logger.info('Email not sent (no mail service configured):', {
        to,
        subject,
        from: senderEmail,
      })
      return {
        success: true,
        message: 'Email logging successful (no mail service configured)',
        data: { id: 'mock-email-id' },
      }
    }

    const { data, error } = await resend.emails.send({
      from: `${SENDER_NAME} <${senderEmail}>`,
      to,
      subject,
      html,
      replyTo: replyTo || SUPPORT_EMAIL,
      headers,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
        contentType: attachment.contentType,
      })),
    })

    if (error) {
      logger.error('Resend API error:', error)
      return {
        success: false,
        message: error.message || 'Failed to send email',
      }
    }

    return {
      success: true,
      message: 'Email sent successfully via Resend',
      data,
    }
  } catch (error) {
    logger.error('Error sending email:', error)
    return {
      success: false,
      message: 'Failed to send email',
    }
  }
}

export async function sendBatchEmails({
  emails,
}: BatchEmailOptions): Promise<BatchSendEmailResult> {
  try {
    const senderEmail = NOREPLY_EMAIL
    const results: SendEmailResult[] = []

    // Use SMTP if configured and enabled
    if (useSmtp) {
      logger.info('Sending batch emails via SMTP:', {
        emailCount: emails.length,
      })

      let allSuccessful = true

      for (const email of emails) {
        try {
          const info = await smtpTransporter.sendMail({
            from: `${SENDER_NAME} <${email.from || senderEmail}>`,
            to: email.to,
            subject: email.subject,
            html: email.html,
            replyTo: SUPPORT_EMAIL,
            attachments: email.attachments,
            headers: email.headers,
          })

          results.push({
            success: true,
            message: 'Email sent successfully via SMTP',
            data: { id: info.messageId, response: info.response },
          })
        } catch (emailError) {
          logger.error('Failed to send email via SMTP:', emailError)
          results.push({
            success: false,
            message: emailError instanceof Error ? emailError.message : 'Failed to send email',
          })
          allSuccessful = false
        }

        // Add small delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      return {
        success: allSuccessful,
        message: allSuccessful
          ? 'All batch emails sent successfully via SMTP'
          : 'Some batch emails failed to send via SMTP',
        results,
        data: { count: results.filter((r) => r.success).length },
      }
    }

    // Fallback to Resend
    if (!resend) {
      logger.info('Batch emails not sent (no mail service configured):', {
        emailCount: emails.length,
      })

      // Create mock results for each email
      emails.forEach(() => {
        results.push({
          success: true,
          message: 'Email logging successful (no mail service configured)',
          data: { id: 'mock-email-id' },
        })
      })

      return {
        success: true,
        message: 'Batch email logging successful (no mail service configured)',
        results,
        data: { ids: Array(emails.length).fill('mock-email-id') },
      }
    }

    // Prepare emails for batch sending
    const batchEmails = emails.map((email) => ({
      from: `${SENDER_NAME} <${email.from || senderEmail}>`,
      to: email.to,
      subject: email.subject,
      html: email.html,
      reply_to: SUPPORT_EMAIL,
      headers: email.headers,
      attachments: email.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
        contentType: attachment.contentType,
      })),
    }))

    // Send batch emails (maximum 100 per batch as per Resend API limits)
    // Process in chunks of 50 to be safe
    const BATCH_SIZE = 50
    let allSuccessful = true

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    let rateDelay = 500

    for (let i = 0; i < batchEmails.length; i += BATCH_SIZE) {
      if (i > 0) {
        logger.info(`Rate limit protection: Waiting ${rateDelay}ms before sending next batch`)
        await delay(rateDelay)
      }

      const batch = batchEmails.slice(i, i + BATCH_SIZE)

      try {
        logger.info(
          `Sending batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(batchEmails.length / BATCH_SIZE)} (${batch.length} emails)`
        )
        const response = await resend.batch.send(batch)

        if (response.error) {
          logger.error('Resend batch API error:', response.error)

          // Add failure results for this batch
          batch.forEach(() => {
            results.push({
              success: false,
              message: response.error?.message || 'Failed to send batch email',
            })
          })

          allSuccessful = false
        } else if (response.data) {
          if (Array.isArray(response.data)) {
            response.data.forEach((item: { id: string }) => {
              results.push({
                success: true,
                message: 'Email sent successfully',
                data: item,
              })
            })
          } else {
            logger.info('Resend batch API returned unexpected format, assuming success')
            batch.forEach((_, index) => {
              results.push({
                success: true,
                message: 'Email sent successfully',
                data: { id: `batch-${i}-item-${index}` },
              })
            })
          }
        }
      } catch (error) {
        logger.error('Error sending batch emails:', error)

        // Check if it's a rate limit error
        if (
          error instanceof Error &&
          (error.message.toLowerCase().includes('rate') ||
            error.message.toLowerCase().includes('too many') ||
            error.message.toLowerCase().includes('429'))
        ) {
          logger.warn('Rate limit exceeded, increasing delay and retrying...')

          // Wait a bit longer and try again with this batch
          await delay(rateDelay * 5)

          try {
            logger.info(`Retrying batch ${Math.floor(i / BATCH_SIZE) + 1} with longer delay`)
            const retryResponse = await resend.batch.send(batch)

            if (retryResponse.error) {
              logger.error('Retry failed with error:', retryResponse.error)

              batch.forEach(() => {
                results.push({
                  success: false,
                  message: retryResponse.error?.message || 'Failed to send batch email after retry',
                })
              })

              allSuccessful = false
            } else if (retryResponse.data) {
              if (Array.isArray(retryResponse.data)) {
                retryResponse.data.forEach((item: { id: string }) => {
                  results.push({
                    success: true,
                    message: 'Email sent successfully on retry',
                    data: item,
                  })
                })
              } else {
                batch.forEach((_, index) => {
                  results.push({
                    success: true,
                    message: 'Email sent successfully on retry',
                    data: { id: `retry-batch-${i}-item-${index}` },
                  })
                })
              }

              // Increase the standard delay since we hit a rate limit
              logger.info('Increasing delay between batches after rate limit hit')
              rateDelay = rateDelay * 2
            }
          } catch (retryError) {
            logger.error('Retry also failed:', retryError)

            batch.forEach(() => {
              results.push({
                success: false,
                message:
                  retryError instanceof Error
                    ? retryError.message
                    : 'Failed to send email even after retry',
              })
            })

            allSuccessful = false
          }
        } else {
          // Non-rate limit error
          batch.forEach(() => {
            results.push({
              success: false,
              message: error instanceof Error ? error.message : 'Failed to send batch email',
            })
          })

          allSuccessful = false
        }
      }
    }

    return {
      success: allSuccessful,
      message: allSuccessful
        ? 'All batch emails sent successfully'
        : 'Some batch emails failed to send',
      results,
      data: { count: results.filter((r) => r.success).length },
    }
  } catch (error) {
    logger.error('Error in batch email sending:', error)
    return {
      success: false,
      message: 'Failed to send batch emails',
      results: [],
    }
  }
}
