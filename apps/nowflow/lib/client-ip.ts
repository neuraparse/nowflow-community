/**
 * Extract the real client IP from a request.
 *
 * Header priority (Cloudflare-first):
 *   1. `CF-Connecting-IP`   — set only by Cloudflare's edge; when the origin
 *      is locked to Cloudflare via Authenticated Origin Pulls, this is the
 *      only trustworthy source.
 *   2. `True-Client-IP`     — enterprise CF + some load balancers.
 *   3. First hop of `X-Forwarded-For` — legacy proxy fallback.
 *   4. `X-Real-IP`          — nginx-style single-IP header.
 *
 * Callers pass either a plain `Headers` object or any object with a `.get()`
 * method (NextRequest/Request/Headers are all compatible).
 */

type HeaderLike = { get: (name: string) => string | null }

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

export function getClientIp(headers: HeaderLike): string {
  const cfConnecting = headers.get('cf-connecting-ip')
  if (cfConnecting) return cfConnecting.trim()

  const trueClient = headers.get('true-client-ip')
  if (trueClient) return trueClient.trim()

  const forwarded = firstForwardedIp(headers.get('x-forwarded-for'))
  if (forwarded) return forwarded

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

/**
 * Returns true if the request appears to have transited Cloudflare's edge.
 * Useful when deciding whether to trust `CF-Connecting-IP` in audit logs.
 * Attackers can spoof the header from direct-origin hits — combine with
 * Authenticated Origin Pulls (mTLS) at the edge for strict enforcement.
 */
export function didTransitCloudflare(headers: HeaderLike): boolean {
  return Boolean(headers.get('cf-ray'))
}
