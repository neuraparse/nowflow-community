import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('Executor')

/**
 * Extracts a meaningful error message from any error object structure.
 * Handles nested error objects, undefined messages, and various error formats.
 *
 * @param error - The error object to extract a message from
 * @returns A meaningful error message string
 */
export function extractErrorMessage(error: any): string {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error
  }

  // If it has a message property, use that
  if (error.message) {
    return error.message
  }

  // If it's an object with response data, include that
  if (error.response?.data) {
    const data = error.response.data
    if (typeof data === 'string') {
      return data
    }
    if (data.message) {
      return data.message
    }
    return JSON.stringify(data)
  }

  // If it's an object, stringify it
  if (typeof error === 'object') {
    return JSON.stringify(error)
  }

  // Fallback to string conversion
  return String(error)
}

/**
 * Sanitizes an error object for logging purposes.
 * Ensures the error is in a format that won't cause "undefined" to appear in logs.
 *
 * @param error - The error object to sanitize
 * @returns A sanitized version of the error for logging
 */
export function sanitizeError(error: any): any {
  // If it's already a string, return it
  if (typeof error === 'string') {
    return error
  }

  // If it has a message property, return that
  if (error.message) {
    return error.message
  }

  // If it's an object with response data, include that
  if (error.response?.data) {
    const data = error.response.data
    if (typeof data === 'string') {
      return data
    }
    if (data.message) {
      return data.message
    }
    return JSON.stringify(data)
  }

  // If it's an object, stringify it
  if (typeof error === 'object') {
    return JSON.stringify(error)
  }

  // Fallback to string conversion
  return String(error)
}
