import { NextRequest, NextResponse } from 'next/server'
import { createFirstUser, FirstRunSetupError, isFirstRunSetupError } from '@/lib/setup/first-user'

export const dynamic = 'force-dynamic'

async function verifyTurnstileIfConfigured(request: NextRequest) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) return

  const token = request.headers.get('x-captcha-response')
  if (!token) {
    throw new FirstRunSetupError(
      400,
      'CAPTCHA_REQUIRED',
      'Please complete the verification challenge.'
    )
  }

  const body = new URLSearchParams()
  body.set('secret', secretKey)
  body.set('response', token)

  const remoteIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')
  if (remoteIp) body.set('remoteip', remoteIp.split(',')[0].trim())

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  })

  const result = (await response.json().catch(() => null)) as { success?: boolean } | null

  if (!response.ok || !result?.success) {
    throw new FirstRunSetupError(
      403,
      'CAPTCHA_FAILED',
      'Verification failed. Please refresh and try again.'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyTurnstileIfConfigured(request)

    const body = await request.json().catch(() => {
      throw new FirstRunSetupError(400, 'INVALID_JSON', 'Request body must be valid JSON.')
    })
    const result = await createFirstUser({
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      workspaceName: body.workspaceName ? String(body.workspaceName) : undefined,
    })

    return NextResponse.json(
      {
        success: true,
        email: result.user.email,
        defaultWorkflowCreated: result.defaultWorkflowCreated,
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    if (isFirstRunSetupError(error)) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: error.message,
        },
        {
          status: error.status,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    return NextResponse.json(
      {
        success: false,
        code: 'SETUP_FAILED',
        error: 'Failed to complete initial setup.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}
