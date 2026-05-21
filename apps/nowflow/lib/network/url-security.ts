import dns from 'dns/promises'
import net from 'net'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::',
  '::1',
  'metadata.google.internal',
])

function isBlockedIpv4(address: string) {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return true
  }

  const [a, b] = octets

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase()

  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice(7)
    if (net.isIP(mappedIpv4) === 4) {
      return isBlockedIpv4(mappedIpv4)
    }
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

function isBlockedAddress(address: string) {
  const ipVersion = net.isIP(address)

  if (ipVersion === 4) {
    return isBlockedIpv4(address)
  }

  if (ipVersion === 6) {
    return isBlockedIpv6(address)
  }

  return false
}

export async function assertSafePublicUrl(rawUrl: string) {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed')
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('Credentialed URLs are not allowed')
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa')
  ) {
    throw new Error('URL points to a private or internal host')
  }

  if (isBlockedAddress(hostname)) {
    throw new Error('URL points to a private or internal IP address')
  }

  let resolvedAddresses
  try {
    resolvedAddresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('Unable to resolve URL hostname')
  }

  if (!resolvedAddresses.length) {
    throw new Error('Unable to resolve URL hostname')
  }

  if (resolvedAddresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error('URL resolves to a private or internal IP address')
  }

  return parsedUrl
}
