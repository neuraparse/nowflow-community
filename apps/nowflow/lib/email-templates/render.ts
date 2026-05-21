import { APP_DOMAIN } from '@/lib/config/app-urls'
import type { EmailTemplateFormat } from './registry'

export function sanitizeEmailHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export function sanitizeHtmlForEmail(html: string): string {
  let out = html

  // Strip script/style tags (emails shouldn't contain these)
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  out = out.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Strip inline event handlers like onclick=
  out = out.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')

  // Neutralize javascript: URLs
  out = out.replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1=$2#$2')

  return out
}

export interface EmailShellOptions {
  brandName?: string
  brandUrl?: string
  logoUrl?: string
  logoAlt?: string
  logoWidth?: number
  headerHtml?: string
  footerHtml?: string
  showLogo?: boolean
}

function resolveLogoWidth(value?: number): number {
  if (!value || !Number.isFinite(value)) return 120
  return Math.min(Math.max(Math.round(value), 40), 320)
}

export function wrapBrandedEmail(innerHtml: string, options?: EmailShellOptions): string {
  const baseUrl = APP_DOMAIN
  const brandUrl = options?.brandUrl || process.env.EMAIL_BRAND_URL || baseUrl
  const brandName = options?.brandName || process.env.EMAIL_BRAND_NAME || 'NowFlow'
  const logoUrl =
    options?.logoUrl ||
    process.env.EMAIL_BRAND_LOGO_URL ||
    `${baseUrl}/static/nowflow-logo-email.png`
  const logoAlt = options?.logoAlt || process.env.EMAIL_BRAND_LOGO_ALT || brandName
  const logoWidth = resolveLogoWidth(
    options?.logoWidth ?? Number(process.env.EMAIL_BRAND_LOGO_WIDTH)
  )
  const headerLogoSize = Math.min(logoWidth, 72)
  const headerHtmlRaw = options?.headerHtml || process.env.EMAIL_BRAND_HEADER_HTML || ''
  const footerHtmlRaw = options?.footerHtml || process.env.EMAIL_BRAND_FOOTER_HTML || ''

  // Use PNG for better email client compatibility (Gmail and others strip SVG for security)
  const logoMarkup = `<img src="${logoUrl}" width="${headerLogoSize}" height="${headerLogoSize}" alt="${logoAlt}" style="display:block;width:${headerLogoSize}px;height:${headerLogoSize}px;object-fit:contain;" />`

  // Professional, minimal header aligned with NowFlow landing page design system
  const defaultHeaderHtml = [
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">',
    '<tr>',
    '<td align="center" style="padding:0 20px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:420px;">',
    '<tr>',
    '<td align="center" style="padding:0 0 18px;">',
    `<div style="padding:10px;display:inline-block;border-radius:12px;background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.04);">`,
    logoMarkup,
    '</div>',
    '</td>',
    '</tr>',
    '<tr>',
    `<td align="center" style="font-size:17px;font-weight:500;letter-spacing:-0.03em;color:#27272a;">${brandName}</td>`,
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
  ].join('')

  // Minimal footer matching landing page design
  const defaultFooterHtml = [
    `<div style="display:inline-block;padding:4px 14px;border-radius:100px;background:#f0faf6;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#4A7A68;margin-bottom:12px;">${brandName}</div>`,
    `<div style="margin-bottom:8px;font-size:12px;">`,
    `<a href="${brandUrl}" style="color:#4A7A68;text-decoration:none;font-weight:500;letter-spacing:-0.03em;">${brandUrl.replace('https://', '')}</a>`,
    `</div>`,
    `<div style="font-size:12px;color:#d4d4d8;">© ${new Date().getFullYear()} ${brandName} Contributors. Apache-2.0 licensed.</div>`,
  ].join('')

  const headerHtml = headerHtmlRaw
    ? sanitizeHtmlForEmail(headerHtmlRaw)
    : options?.showLogo === false
      ? ''
      : defaultHeaderHtml

  const footerHtml = footerHtmlRaw ? sanitizeHtmlForEmail(footerHtmlRaw) : defaultFooterHtml

  const shellStart = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${brandName}</title>`,
    // Modern web font matching landing page
    '<style>@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap");</style>',
    '</head>',
    '<body style="margin:0;padding:0;background-color:#fafafa;">',
    '<div style="background-color:#fafafa;font-family:\'Plus Jakarta Sans\',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;">',
    '<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:20px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 2px rgba(0,0,0,0.03),0 8px 32px rgba(0,0,0,0.05);overflow:hidden;">',
    '<div style="height:3px;background:linear-gradient(90deg,#5B7B6F,#4A7A68,#6B8F80);border-radius:20px 20px 0 0;"></div>',
    headerHtml
      ? `<div style="padding:48px 20px 32px;text-align:center;background-color:#ffffff;">${headerHtml}</div>`
      : '',
    '<div style="padding:0 32px 48px 32px;">',
  ].join('')

  const shellEnd = [
    '</div>',
    `<div style="padding:28px 20px;text-align:center;border-top:1px solid rgba(0,0,0,0.05);">`,
    `<div style="font-size:12px;color:#a1a1aa;line-height:1.6;">`,
    footerHtml,
    `</div>`,
    `</div>`,
    '</div>',
    '</div>',
    '</body>',
    '</html>',
  ].join('')

  return shellStart + innerHtml + shellEnd
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getTokenValue(data: Record<string, unknown>, tokenName: string): string {
  const raw = data[tokenName]
  if (raw === null || raw === undefined) return ''
  return typeof raw === 'string' ? raw : String(raw)
}

export function renderTemplateString(
  template: string,
  data: Record<string, unknown>,
  mode: 'html' | 'text'
): string {
  const safe = template.replace(/\{\{\{([a-zA-Z0-9_]+)\}\}\}/g, (_match, tokenName) => {
    const value = getTokenValue(data, tokenName)
    return mode === 'html' ? value : value
  })

  return safe.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, tokenName) => {
    const value = getTokenValue(data, tokenName)
    return mode === 'html' ? escapeHtml(value) : value
  })
}

export function renderBodyToHtml(
  format: EmailTemplateFormat,
  bodyTemplate: string,
  data: Record<string, unknown>
): string {
  if (format === 'html') {
    const rendered = renderTemplateString(bodyTemplate, data, 'html')
    return wrapBrandedEmail(sanitizeHtmlForEmail(rendered))
  }

  const text = renderTemplateString(bodyTemplate, data, 'text').trim()
  const paragraphs = text.split(/\n{2,}/g).filter(Boolean)
  const html = paragraphs
    .map((p) => {
      const escaped = escapeHtml(p).replace(/\n/g, '<br />')
      return `<p style="font-size:15px;line-height:1.65;color:#71717a;margin:0 0 16px 0;">${escaped}</p>`
    })
    .join('')

  return wrapBrandedEmail(html)
}

export function templateContainsToken(template: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\{\\{\\{?${escaped}\\}?\\}\\}`)
  return re.test(template)
}
