/**
 * Cross-browser clipboard helpers.
 *
 * Extracted from `lib/utils.ts`. Tries the modern Clipboard API first, falls
 * back to a hidden textarea + `document.execCommand('copy')` for older
 * browsers and non-secure contexts. Callers should import from `@/lib/utils`
 * (the canonical entry — re-exports this symbol).
 */
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Clipboard')

/**
 * Copy text to clipboard with fallback support.
 * Returns `true` on success, `false` on failure (logged).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    const success = document.execCommand('copy')
    document.body.removeChild(textArea)
    return success
  } catch (error) {
    logger.error('Failed to copy to clipboard:', error)
    return false
  }
}
