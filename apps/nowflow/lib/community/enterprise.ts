export const ENTERPRISE_URL = process.env.NEXT_PUBLIC_ENTERPRISE_URL?.trim() || 'https://nowflow.io'

export const ENTERPRISE_REQUEST_LABEL = 'Request Enterprise'

export function openEnterpriseUrl() {
  if (typeof window === 'undefined') return
  window.open(ENTERPRISE_URL, '_blank', 'noopener,noreferrer')
}
