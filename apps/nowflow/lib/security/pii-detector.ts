import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('PIIDetector')

export type PIIType =
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'ssn'
  | 'name'
  | 'address'
  | 'ip_address'
  | 'date_of_birth'
  | 'passport'
  | 'tc_kimlik' // Turkish ID number

export type MaskingMode = 'hash' | 'asterisk' | 'remove' | 'redact'

export interface PIIMatch {
  type: PIIType
  value: string
  start: number
  end: number
  confidence: number
}

export interface PIIDetectionResult {
  hasPI: boolean
  matches: PIIMatch[]
  maskedText: string
}

// PII detection patterns
const PII_PATTERNS: Record<PIIType, RegExp[]> = {
  email: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
  phone: [
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, // US
    /\b\+?90[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}\b/g, // Turkey
    /\b\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, // International
  ],
  credit_card: [
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ],
  ssn: [/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g],
  tc_kimlik: [/\b[1-9]\d{10}\b/g], // Turkish ID: 11 digits starting with non-zero
  ip_address: [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  date_of_birth: [
    /\b(?:0[1-9]|[12]\d|3[01])[-/.](?:0[1-9]|1[0-2])[-/.]\d{4}\b/g,
    /\b\d{4}[-/.](?:0[1-9]|1[0-2])[-/.](?:0[1-9]|[12]\d|3[01])\b/g,
  ],
  name: [], // Names are detected through context, not patterns
  address: [], // Addresses are detected through context
  passport: [/\b[A-Z]{1,2}\d{6,9}\b/g],
}

/**
 * Detect PII in text
 */
export function detectPII(
  text: string,
  typesToDetect: PIIType[] = ['email', 'phone', 'credit_card', 'ssn']
): PIIDetectionResult {
  const matches: PIIMatch[] = []

  for (const piiType of typesToDetect) {
    const patterns = PII_PATTERNS[piiType]
    if (!patterns) continue

    for (const pattern of patterns) {
      // Reset regex state
      const regex = new RegExp(pattern.source, pattern.flags)
      let match: RegExpExecArray | null

      while ((match = regex.exec(text)) !== null) {
        // Validate the match
        const isValid = validateMatch(piiType, match[0])
        if (isValid) {
          matches.push({
            type: piiType,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: getConfidence(piiType, match[0]),
          })
        }
      }
    }
  }

  // Remove duplicate/overlapping matches
  const dedupedMatches = deduplicateMatches(matches)

  return {
    hasPI: dedupedMatches.length > 0,
    matches: dedupedMatches,
    maskedText: text, // Masking done separately
  }
}

/**
 * Mask PII in text
 */
export function maskPII(text: string, matches: PIIMatch[], mode: MaskingMode = 'asterisk'): string {
  if (matches.length === 0) return text

  // Sort matches by position (reverse to avoid offset issues)
  const sortedMatches = [...matches].sort((a, b) => b.start - a.start)
  let masked = text

  for (const match of sortedMatches) {
    const replacement = getMaskReplacement(match, mode)
    masked = masked.slice(0, match.start) + replacement + masked.slice(match.end)
  }

  return masked
}

/**
 * Detect and mask PII in one step
 */
export function detectAndMaskPII(
  text: string,
  typesToDetect?: PIIType[],
  mode: MaskingMode = 'asterisk'
): PIIDetectionResult {
  const result = detectPII(text, typesToDetect)
  result.maskedText = maskPII(text, result.matches, mode)
  return result
}

/**
 * Process a JSON object and detect/mask PII in all string values
 */
export function processObjectForPII(
  obj: any,
  typesToDetect?: PIIType[],
  mode: MaskingMode = 'asterisk',
  exemptFields: string[] = [],
  path: string = ''
): { result: any; matches: PIIMatch[]; fieldsProcessed: number } {
  const allMatches: PIIMatch[] = []
  let fieldsProcessed = 0

  function processValue(value: any, currentPath: string): any {
    if (exemptFields.includes(currentPath)) return value

    if (typeof value === 'string') {
      fieldsProcessed++
      const detection = detectAndMaskPII(value, typesToDetect, mode)
      if (detection.hasPI) {
        allMatches.push(
          ...detection.matches.map((m) => ({
            ...m,
            value: `${currentPath}: ${m.value}`,
          }))
        )
      }
      return detection.maskedText
    }

    if (Array.isArray(value)) {
      return value.map((item, i) => processValue(item, `${currentPath}[${i}]`))
    }

    if (value && typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const [key, val] of Object.entries(value)) {
        result[key] = processValue(val, currentPath ? `${currentPath}.${key}` : key)
      }
      return result
    }

    return value
  }

  return {
    result: processValue(obj, path),
    matches: allMatches,
    fieldsProcessed,
  }
}

function validateMatch(type: PIIType, value: string): boolean {
  switch (type) {
    case 'credit_card':
      return luhnCheck(value.replace(/[-\s]/g, ''))
    case 'ssn':
      const cleaned = value.replace(/[-\s]/g, '')
      return cleaned.length === 9 && !/^(000|666|9\d\d)/.test(cleaned)
    case 'email':
      return value.includes('@') && value.includes('.')
    case 'tc_kimlik':
      return validateTCKimlik(value)
    case 'ip_address':
      return value.split('.').every((n) => parseInt(n) >= 0 && parseInt(n) <= 255)
    default:
      return true
  }
}

function luhnCheck(num: string): boolean {
  if (!/^\d+$/.test(num)) return false
  let sum = 0
  let alt = false
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i])
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

function validateTCKimlik(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false
  if (value[0] === '0') return false
  const digits = value.split('').map(Number)
  const sumOdd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const sumEven = digits[1] + digits[3] + digits[5] + digits[7]
  const check10 = (sumOdd * 7 - sumEven) % 10
  if (check10 !== digits[9]) return false
  const totalSum = digits.slice(0, 10).reduce((a, b) => a + b, 0)
  return totalSum % 10 === digits[10]
}

function getConfidence(type: PIIType, value: string): number {
  switch (type) {
    case 'email':
      return 0.95
    case 'credit_card':
      return luhnCheck(value.replace(/[-\s]/g, '')) ? 0.95 : 0.5
    case 'ssn':
      return 0.85
    case 'phone':
      return 0.75
    case 'tc_kimlik':
      return validateTCKimlik(value) ? 0.9 : 0.4
    case 'ip_address':
      return 0.8
    default:
      return 0.6
  }
}

function getMaskReplacement(match: PIIMatch, mode: MaskingMode): string {
  switch (mode) {
    case 'asterisk':
      return '*'.repeat(match.value.length)
    case 'hash':
      return `[${match.type.toUpperCase()}_HASH_${simpleHash(match.value)}]`
    case 'remove':
      return ''
    case 'redact':
      return `[${match.type.toUpperCase()}_REDACTED]`
    default:
      return '*'.repeat(match.value.length)
  }
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16).slice(0, 8)
}

function deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
  const sorted = matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const result: PIIMatch[] = []

  for (const match of sorted) {
    const last = result[result.length - 1]
    if (!last || match.start >= last.end) {
      result.push(match)
    } else if (match.confidence > last.confidence) {
      result[result.length - 1] = match
    }
  }

  return result
}
