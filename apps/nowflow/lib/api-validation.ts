/**
 * API Request Validation Utilities
 * Provides common validation functions for API endpoints
 */
import { NextRequest } from 'next/server'

export interface PaginationParams {
  limit: number
  offset: number
}

export interface SortParams {
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface FilterParams {
  [key: string]: string | undefined
}

/**
 * Extract and validate pagination parameters from request
 * @param request - Next.js request object
 * @param maxLimit - Maximum allowed limit (default: 100)
 * @returns Validated pagination parameters
 */
export function extractPaginationParams(
  request: NextRequest,
  maxLimit: number = 100
): PaginationParams {
  const { searchParams } = new URL(request.url)

  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')

  let limit = 50 // default
  let offset = 0 // default

  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit)
    }
  }

  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed
    }
  }

  return { limit, offset }
}

/**
 * Extract and validate sort parameters from request
 * @param request - Next.js request object
 * @param allowedFields - List of allowed fields for sorting
 * @param defaultField - Default field to sort by
 * @returns Validated sort parameters
 */
export function extractSortParams(
  request: NextRequest,
  allowedFields: string[],
  defaultField: string = 'createdAt'
): SortParams {
  const { searchParams } = new URL(request.url)

  const sortByParam = searchParams.get('sortBy')
  const sortOrderParam = searchParams.get('sortOrder')

  const sortBy = sortByParam && allowedFields.includes(sortByParam) ? sortByParam : defaultField

  const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc'

  return { sortBy, sortOrder }
}

/**
 * Extract search query from request
 * @param request - Next.js request object
 * @param minLength - Minimum search query length (default: 1)
 * @param maxLength - Maximum search query length (default: 100)
 * @returns Sanitized search query or undefined
 */
export function extractSearchQuery(
  request: NextRequest,
  minLength: number = 1,
  maxLength: number = 100
): string | undefined {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')

  if (!search) return undefined

  const trimmed = search.trim()

  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return undefined
  }

  // Basic sanitization - remove SQL-like patterns
  const sanitized = trimmed
    .replace(/[;'"\\]/g, '') // Remove potentially dangerous characters
    .replace(/--/g, '') // Remove SQL comment markers
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end

  return sanitized
}

/**
 * Validate UUID format
 * @param id - String to validate as UUID
 * @returns true if valid UUID, false otherwise
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Validate email format
 * @param email - String to validate as email
 * @returns true if valid email format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Sanitize string input for database queries
 * @param input - String to sanitize
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 500): string {
  return input.trim().slice(0, maxLength).replace(/[<>]/g, '') // Remove potential XSS vectors
}

/**
 * Validate and extract filter parameters
 * @param request - Next.js request object
 * @param allowedFilters - Object mapping filter names to allowed values
 * @returns Validated filter parameters
 */
export function extractFilterParams(
  request: NextRequest,
  allowedFilters: Record<string, string[]>
): FilterParams {
  const { searchParams } = new URL(request.url)
  const filters: FilterParams = {}

  for (const [filterName, allowedValues] of Object.entries(allowedFilters)) {
    const value = searchParams.get(filterName)
    if (value && allowedValues.includes(value)) {
      filters[filterName] = value
    }
  }

  return filters
}

/**
 * Create standardized error response
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Optional error details
 * @returns Error response object
 */
export function createValidationError(message: string, status: number = 400, details?: unknown) {
  return {
    error: message,
    status,
    details: details || undefined,
    timestamp: new Date().toISOString(),
  }
}
