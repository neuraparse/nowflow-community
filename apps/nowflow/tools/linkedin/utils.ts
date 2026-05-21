/**
 * Extract LinkedIn URN from a LinkedIn post URL or return URN as-is
 *
 * Supported formats:
 * - https://www.linkedin.com/feed/update/urn:li:share:1234567890
 * - https://www.linkedin.com/posts/username_activity-1234567890-abcd
 * - https://www.linkedin.com/feed/update/urn:li:ugcPost:1234567890
 * - urn:li:share:1234567890 (returns as-is)
 * - urn:li:ugcPost:1234567890 (returns as-is)
 *
 * @param urlOrUrn - LinkedIn post URL or URN
 * @returns LinkedIn URN (e.g., urn:li:share:1234567890)
 */
export function extractLinkedInUrn(urlOrUrn: string): string {
  // If it's already a URN, return it
  if (urlOrUrn.startsWith('urn:li:')) {
    return urlOrUrn
  }

  try {
    // Try to parse as URL
    const url = new URL(urlOrUrn)

    // Format 1: /feed/update/urn:li:share:1234567890
    // Format 2: /feed/update/urn:li:ugcPost:1234567890
    if (url.pathname.includes('/feed/update/urn:li:')) {
      const match = url.pathname.match(/urn:li:(share|ugcPost):[\w-]+/)
      if (match) {
        return match[0]
      }
    }

    // Format 3: /posts/username_activity-1234567890-abcd
    if (url.pathname.includes('/posts/') && url.pathname.includes('_activity-')) {
      const match = url.pathname.match(/_activity-(\d+)/)
      if (match && match[1]) {
        return `urn:li:activity:${match[1]}`
      }
    }

    // Format 4: Check query params for URN
    const urnParam = url.searchParams.get('urn')
    if (urnParam && urnParam.startsWith('urn:li:')) {
      return urnParam
    }
  } catch (e) {
    // Not a valid URL, might be just an ID
    // Try to handle as numeric ID
    if (/^\d+$/.test(urlOrUrn)) {
      return `urn:li:share:${urlOrUrn}`
    }
  }

  // If we couldn't extract URN, return the original input
  // The API will handle validation
  return urlOrUrn
}
