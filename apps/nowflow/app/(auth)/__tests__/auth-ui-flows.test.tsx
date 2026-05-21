/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestResetForm, SetNewPasswordForm } from '@/app/(auth)/components/reset-password-form'
import LoginPage from '@/app/(auth)/login/login-form'
import SignupPage from '@/app/(auth)/signup/signup-form'

const mocks = vi.hoisted(() => ({
  addNotification: vi.fn(),
  hideNotification: vi.fn(),
  markUserLoggedIn: vi.fn(),
  push: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  signUpEmail: vi.fn(),
  sendVerificationOtp: vi.fn(),
  notifications: [] as Array<any>,
  searchParams: new URLSearchParams(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : (href?.pathname ?? '')} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/app/force-dark', () => ({
  ForceDark: () => null,
}))

vi.mock('@/components/branding/nowflow-brand', () => ({
  NowFlowBrandLockup: () => <span>NowFlow</span>,
}))

vi.mock('@/components/ui/turnstile', () => ({
  TURNSTILE_SITE_KEY: undefined,
  Turnstile: () => <div data-testid="turnstile" />,
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('@/lib/auth/client-utils', () => ({
  markUserLoggedIn: mocks.markUserLoggedIn,
}))

vi.mock('@/lib/auth-client', () => ({
  client: {
    signIn: {
      email: mocks.signInEmail,
      social: mocks.signInSocial,
    },
    signUp: {
      email: mocks.signUpEmail,
    },
    emailOtp: {
      sendVerificationOtp: mocks.sendVerificationOtp,
    },
  },
}))

vi.mock('@/stores/notifications/store', () => {
  const useNotificationStore = () => ({
    notifications: mocks.notifications,
    addNotification: mocks.addNotification,
    hideNotification: mocks.hideNotification,
  })
  useNotificationStore.getState = () => ({
    notifications: mocks.notifications,
    addNotification: mocks.addNotification,
    hideNotification: mocks.hideNotification,
  })
  return { useNotificationStore }
})

function setSearchParams(query = '') {
  mocks.searchParams = new URLSearchParams(query)
}

function renderLogin() {
  return render(<LoginPage githubAvailable={false} googleAvailable={false} isProduction={false} />)
}

function renderSignup() {
  return render(<SignupPage githubAvailable={false} googleAvailable={false} isProduction={false} />)
}

function RequestResetHarness({
  onSubmit,
  submitDisabled,
}: {
  onSubmit: (email: string) => Promise<void>
  submitDisabled?: boolean
}) {
  const [email, setEmail] = React.useState('')

  return (
    <RequestResetForm
      email={email}
      onEmailChange={setEmail}
      onSubmit={onSubmit}
      isSubmitting={false}
      statusType={null}
      statusMessage=""
      submitDisabled={submitDisabled}
    />
  )
}

async function fillLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email address/i), 'member@example.com')
  await user.type(screen.getByLabelText(/^password$/i), 'Str0ngPass!')
}

describe('auth UI flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.notifications.length = 0
    setSearchParams()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('signs in with email credentials and redirects to the workspace', async () => {
    const user = userEvent.setup()
    mocks.signInEmail.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })

    renderLogin()

    await fillLoginForm(user)
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(mocks.signInEmail).toHaveBeenCalledWith(
        {
          email: 'member@example.com',
          password: 'Str0ngPass!',
          callbackURL: '/w',
        },
        expect.objectContaining({
          onError: expect.any(Function),
        })
      )
    })
    expect(mocks.markUserLoggedIn).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/w')
  })

  it('shows query-driven auth notifications once and clears stale auth errors', () => {
    const staleError = {
      id: 'old-error',
      type: 'error',
      message: 'Old auth error',
      isVisible: true,
      read: false,
      options: { context: 'auth' },
    }
    const workflowError = {
      id: 'workflow-error',
      type: 'error',
      message: 'Workflow error',
      isVisible: true,
      read: false,
      options: { context: 'workflow' },
    }
    mocks.notifications.push(staleError, workflowError)
    setSearchParams('resetSuccess=true&fromLogout=true')

    renderLogin()

    expect(mocks.hideNotification).toHaveBeenCalledWith('old-error')
    expect(mocks.hideNotification).not.toHaveBeenCalledWith('workflow-error')
    expect(mocks.addNotification).toHaveBeenCalledWith(
      'info',
      'Password reset successful. Please sign in.',
      null,
      { context: 'auth' }
    )
    expect(mocks.addNotification).toHaveBeenCalledWith('info', 'You have been signed out.', null, {
      context: 'auth',
    })
  })

  it('toggles login password visibility without changing the typed value', async () => {
    const user = userEvent.setup()

    renderLogin()

    const passwordInput = screen.getByLabelText(/^password$/i)
    await user.type(passwordInput, 'Str0ngPass!')

    expect(passwordInput).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(passwordInput).toHaveValue('Str0ngPass!')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it.each([
    ['INVALID_CREDENTIALS', 'Invalid email or password. Please try again.'],
    ['USER_NOT_FOUND', 'No account found with this email. Please sign up first.'],
    [
      'too many attempts',
      'Too many login attempts. Please try again later or reset your password.',
    ],
    ['account locked', 'Your account has been locked for security. Please reset your password.'],
    ['network error', 'Network error. Please check your connection and try again.'],
    ['rate limit', 'Too many requests. Please wait a moment before trying again.'],
  ])('maps login API error "%s" to a user-facing notification', async (message, expected) => {
    const user = userEvent.setup()
    mocks.signInEmail.mockImplementationOnce(async (_payload, options) => {
      options.onError({ error: { message } })
      return { error: { message } }
    })

    renderLogin()

    await fillLoginForm(user)
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(mocks.addNotification).toHaveBeenCalledWith('error', expected, null, {
        context: 'auth',
      })
    })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('sends a verification OTP and routes unverified login attempts to verify', async () => {
    const user = userEvent.setup()
    mocks.signInEmail.mockResolvedValueOnce({
      error: { message: 'EMAIL_NOT_VERIFIED' },
    })
    mocks.sendVerificationOtp.mockResolvedValueOnce({})

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'pending@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Str0ngPass!')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'pending@example.com',
        type: 'email-verification',
      })
    })
    expect(sessionStorage.getItem('verificationEmail')).toBe('pending@example.com')
    expect(mocks.push).toHaveBeenCalledWith('/verify')
    expect(mocks.addNotification).not.toHaveBeenCalledWith(
      'error',
      expect.stringMatching(/invalid email or password/i),
      expect.anything(),
      expect.anything()
    )
  })

  it('keeps the typed email when navigating from login to forgot password', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'person+flow@example.com')

    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password?email=person%2Bflow%40example.com'
    )
  })

  it('blocks weak signup passwords before calling the signup API', async () => {
    const user = userEvent.setup()

    renderSignup()

    await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'weak')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Password requirements:')).toBeInTheDocument()
    })
    expect(mocks.signUpEmail).not.toHaveBeenCalled()
    expect(mocks.addNotification).toHaveBeenCalledWith(
      'error',
      'Password must be at least 8 characters long.',
      null,
      { context: 'auth' }
    )
  })

  it('prefills signup email from query params and keeps the user editable', async () => {
    const user = userEvent.setup()
    setSearchParams('email=invited%2Bteam%40example.com')

    renderSignup()

    const emailInput = await screen.findByLabelText(/email address/i)
    expect(emailInput).toHaveValue('invited+team@example.com')

    await user.clear(emailInput)
    await user.type(emailInput, 'changed@example.com')

    expect(emailInput).toHaveValue('changed@example.com')
  })

  it.each([
    [
      { status: 422, message: 'already exists' },
      'An account with this email already exists. Please sign in instead.',
    ],
    [{ message: 'INVALID_EMAIL' }, 'Please enter a valid email address.'],
    [
      { message: 'disposable email provider is not supported' },
      'Please use a work email — disposable providers are not allowed.',
    ],
    [{ message: 'rate limit' }, 'Too many signup attempts. Please try again later.'],
  ])('maps signup API errors to user-facing notifications', async (error, expected) => {
    const user = userEvent.setup()
    mocks.signUpEmail.mockImplementationOnce(async (_payload, options) => {
      options.onError({ error })
      return { error }
    })

    renderSignup()

    await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Str0ngPass!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mocks.addNotification).toHaveBeenCalledWith('error', expected, null, {
        context: 'auth',
      })
    })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('creates a signup session and sends the user to email verification', async () => {
    const user = userEvent.setup()
    mocks.signUpEmail.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })

    renderSignup()

    await user.type(screen.getByLabelText(/full name/i), 'Grace Hopper')
    await user.type(screen.getByLabelText(/email address/i), 'grace@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Str0ngPass!')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mocks.signUpEmail).toHaveBeenCalledWith(
        {
          email: 'grace@example.com',
          password: 'Str0ngPass!',
          name: 'Grace Hopper',
        },
        expect.objectContaining({
          onError: expect.any(Function),
        })
      )
    })
    expect(sessionStorage.getItem('verificationEmail')).toBe('grace@example.com')
    expect(mocks.push).toHaveBeenCalledWith('/verify?fromSignup=true')
  })

  it('submits the forgot-password form with the controlled email value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<RequestResetHarness onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/email address/i), 'reset@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('reset@example.com')
    })
  })

  it('keeps forgot-password submit disabled until an external captcha requirement is satisfied', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<RequestResetHarness onSubmit={onSubmit} submitDisabled />)

    await user.type(screen.getByLabelText(/email address/i), 'reset@example.com')

    expect(screen.getByRole('button', { name: /send reset link/i })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks reset-password submission when token is missing', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <SetNewPasswordForm
        token={null}
        onSubmit={onSubmit}
        isSubmitting={false}
        statusType={null}
        statusMessage=""
      />
    )

    expect(screen.getByLabelText(/^new password$/i)).toBeDisabled()
    expect(screen.getByLabelText(/confirm password/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /reset password/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates reset password confirmation before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <SetNewPasswordForm
        token="reset-token"
        onSubmit={onSubmit}
        isSubmitting={false}
        statusType={null}
        statusMessage=""
      />
    )

    await user.type(screen.getByLabelText(/^new password$/i), 'Str0ngPass!')
    await user.type(screen.getByLabelText(/confirm password/i), 'Different1!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText(/confirm password/i))
    await user.type(screen.getByLabelText(/confirm password/i), 'Str0ngPass!')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Str0ngPass!')
    })
  })
})
