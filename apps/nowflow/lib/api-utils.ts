import { NextResponse } from 'next/server'

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(errors: Record<string, string>): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      success: false,
      errors,
      timestamp: new Date().toISOString(),
    },
    { status: 422 }
  )
}

/**
 * Create an unauthorized response
 */
export function createUnauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  )
}

/**
 * Create a forbidden response
 */
export function createForbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
      timestamp: new Date().toISOString(),
    },
    { status: 403 }
  )
}

/**
 * Create a not found response
 */
export function createNotFoundResponse(message: string = 'Not found'): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
      timestamp: new Date().toISOString(),
    },
    { status: 404 }
  )
}

/**
 * Create an internal server error response
 */
export function createInternalServerErrorResponse(
  message: string = 'Internal server error'
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  )
}

/**
 * Parse and validate JSON request body safely
 */
export async function parseRequestBody<T>(
  request: Request
): Promise<{ data: T | null; error: string | null }> {
  try {
    const bodyText = await request.text()

    if (!bodyText || bodyText.trim().length === 0) {
      return { data: null, error: 'Empty request body' }
    }

    const body = JSON.parse(bodyText)
    return { data: body as T, error: null }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { data: null, error: 'Invalid JSON format' }
    }
    return { data: null, error: 'Failed to parse request body' }
  }
}

/**
 * Parse and validate JSON request body (legacy - returns null on error)
 */
export async function parseRequestBodyLegacy<T>(request: Request): Promise<T | null> {
  const result = await parseRequestBody<T>(request)
  return result.data
}

/**
 * Get query parameters from URL
 */
export function getQueryParams(url: string): URLSearchParams {
  const urlObj = new URL(url)
  return urlObj.searchParams
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: Record<string, any>,
  requiredFields: string[]
): Record<string, string> | null {
  const errors: Record<string, string> = {}

  for (const field of requiredFields) {
    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
      errors[field] = `${field} is required`
    }
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

/**
 * Check if email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Generate a random ID
 */
export function generateId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
