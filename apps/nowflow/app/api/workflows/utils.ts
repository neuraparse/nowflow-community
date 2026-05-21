import { NextResponse } from 'next/server'

export function createErrorResponse(
  error: string,
  status: number,
  code?: string,
  additionalData?: any
) {
  return NextResponse.json(
    {
      error,
      code: code || error.toUpperCase().replace(/\s+/g, '_'),
      ...additionalData,
    },
    { status }
  )
}

export function createSuccessResponse(data: any) {
  return NextResponse.json(data)
}
