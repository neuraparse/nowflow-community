import { sanitizeHtmlForEmail } from './render'

export type EmailBlock =
  | { id: string; type: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'image'; src: string; alt?: string; width?: number }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; height?: number }

export function blocksToTemplateSource(blocks: EmailBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        parts.push(block.text || '')
        break
      case 'paragraph':
        parts.push(block.text || '')
        break
      case 'button':
        parts.push(block.label || '')
        parts.push(block.url || '')
        break
      case 'image':
        parts.push(block.src || '')
        parts.push(block.alt || '')
        break
      case 'divider':
        parts.push('---')
        break
      case 'spacer':
        parts.push('')
        break
      default:
        break
    }
  }
  return parts.join('\n')
}

export function sanitizeUrl(url: string): string {
  const trimmed = (url || '').trim()
  const lower = trimmed.toLowerCase()
  if (!trimmed) return '#'
  if (lower.startsWith('javascript:')) return '#'
  if (lower.startsWith('data:')) return '#'
  if (lower.startsWith('vbscript:')) return '#'
  if (lower.startsWith('file:')) return '#'
  return trimmed
}

export function normalizeBlocks(input: unknown): EmailBlock[] {
  if (!Array.isArray(input)) return []
  const out: EmailBlock[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const b: any = item
    if (typeof b.id !== 'string' || typeof b.type !== 'string') continue

    switch (b.type) {
      case 'heading':
        out.push({
          id: b.id,
          type: 'heading',
          text: typeof b.text === 'string' ? b.text : '',
          level: b.level === 1 || b.level === 2 || b.level === 3 ? b.level : 1,
        })
        break
      case 'paragraph':
        out.push({ id: b.id, type: 'paragraph', text: typeof b.text === 'string' ? b.text : '' })
        break
      case 'button':
        out.push({
          id: b.id,
          type: 'button',
          label: typeof b.label === 'string' ? b.label : '',
          url: typeof b.url === 'string' ? b.url : '',
        })
        break
      case 'image':
        out.push({
          id: b.id,
          type: 'image',
          src: typeof b.src === 'string' ? b.src : '',
          alt: typeof b.alt === 'string' ? b.alt : '',
          width: typeof b.width === 'number' && Number.isFinite(b.width) ? b.width : undefined,
        })
        break
      case 'divider':
        out.push({ id: b.id, type: 'divider' })
        break
      case 'spacer':
        out.push({
          id: b.id,
          type: 'spacer',
          height: typeof b.height === 'number' && Number.isFinite(b.height) ? b.height : 16,
        })
        break
      default:
        break
    }
  }
  return out
}

export function blocksToHtml(
  blocks: EmailBlock[],
  renderString: (template: string) => string,
  escapeHtml: (value: string) => string
): string {
  const pieces: string[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const level = block.level ?? 1
        const fontSize = level === 1 ? 24 : level === 2 ? 18 : 16
        const fontWeight = level === 1 ? '300' : '600'
        const margin = level === 1 ? '0 0 24px 0' : '0 0 12px 0'
        const letterSpacing = level === 1 ? '-0.03em' : '-0.01em'
        const inner = sanitizeHtmlForEmail(renderString(block.text))
        pieces.push(
          `<div style="font-size:${fontSize}px;font-weight:${fontWeight};color:#27272a;margin:${margin};line-height:1.2;letter-spacing:${letterSpacing};">${inner}</div>`
        )
        break
      }
      case 'paragraph': {
        const inner = sanitizeHtmlForEmail(renderString(block.text))
        pieces.push(
          `<div style="font-size:15px;line-height:1.65;color:#71717a;margin:0 0 16px 0;">${inner}</div>`
        )
        break
      }
      case 'button': {
        const href = sanitizeUrl(renderString(block.url))
        const label = sanitizeHtmlForEmail(renderString(block.label || 'Open'))
        pieces.push(
          `<a href="${escapeHtml(href)}" style="display:inline-block;background-color:#27272a;color:#ffffff;font-weight:600;font-size:13px;padding:13px 28px;border-radius:12px;text-decoration:none;text-align:center;margin:0 0 16px 0;letter-spacing:0.02em;">${label}</a>`
        )
        break
      }
      case 'image': {
        const src = sanitizeUrl(renderString(block.src))
        const width = block.width && block.width > 0 ? Math.min(block.width, 560) : 520
        const alt = escapeHtml(renderString(block.alt || ''))
        pieces.push(
          `<div style="margin:0 0 16px 0;"><img src="${escapeHtml(
            src
          )}" alt="${alt}" width="${width}" style="display:block;max-width:100%;height:auto;border-radius:12px;" /></div>`
        )
        break
      }
      case 'divider':
        pieces.push(
          `<hr style="border:none;border-top:1px solid rgba(0,0,0,0.05);margin:24px 0;" />`
        )
        break
      case 'spacer': {
        const h = block.height && block.height > 0 ? Math.min(block.height, 80) : 16
        pieces.push(`<div style="height:${h}px;line-height:${h}px;">&nbsp;</div>`)
        break
      }
      default:
        break
    }
  }
  return pieces.join('')
}

export function blocksToText(
  blocks: EmailBlock[],
  renderString: (template: string) => string
): string {
  const parts: string[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        parts.push(renderString(block.text).trim())
        parts.push('')
        break
      case 'paragraph':
        parts.push(renderString(block.text).trim())
        parts.push('')
        break
      case 'button':
        parts.push(`${renderString(block.label).trim()}: ${renderString(block.url).trim()}`)
        parts.push('')
        break
      case 'image':
        parts.push(renderString(block.src).trim())
        parts.push('')
        break
      case 'divider':
        parts.push('---')
        parts.push('')
        break
      case 'spacer':
        parts.push('')
        break
      default:
        break
    }
  }
  return parts.join('\n').trim()
}
