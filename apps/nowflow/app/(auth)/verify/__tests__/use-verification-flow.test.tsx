/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useVerification } from '@/app/(auth)/verify/use-verification'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  sendVerificationOtp: vi.fn(),
  verifyEmail: vi.fn(),
  addNotification: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))

vi.mock('@/lib/auth-client', () => ({
  client: {
    emailOtp: {
      sendVerificationOtp: mocks.sendVerificationOtp,
      verifyEmail: mocks.verifyEmail,
    },
  },
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@/stores/notifications/store', () => ({
  useNotificationStore: () => ({
    addNotification: mocks.addNotification,
  }),
}))

function setSearchParams(query = '') {
  mocks.searchParams = new URLSearchParams(query)
}

function Harness({ hasResendKey = true }: { hasResendKey?: boolean }) {
  const verification = useVerification({ hasResendKey, isProduction: false })

  return (
    <div>
      <output aria-label="email">{verification.email}</output>
      <output aria-label="otp">{verification.otp}</output>
      <output aria-label="complete">{String(verification.isOtpComplete)}</output>
      <output aria-label="verified">{String(verification.isVerified)}</output>
      <output aria-label="error">{verification.errorMessage}</output>
      <button type="button" onClick={() => verification.handleOtpChange('123456')}>
        Fill valid OTP
      </button>
      <button type="button" onClick={() => verification.handleOtpChange('000000')}>
        Fill invalid OTP
      </button>
      <button type="button" onClick={verification.verifyCode}>
        Verify
      </button>
      <button type="button" onClick={verification.resendCode}>
        Resend
      </button>
    </div>
  )
}

describe('useVerification flow', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setSearchParams()
    sessionStorage.clear()
    sessionStorage.setItem('verificationEmail', 'pending@example.com')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads the pending email and sends an initial OTP outside the signup handoff', async () => {
    mocks.sendVerificationOtp.mockResolvedValueOnce({})

    render(<Harness />)

    expect(await screen.findByLabelText('email')).toHaveTextContent('pending@example.com')
    await waitFor(() => {
      expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'pending@example.com',
        type: 'email-verification',
      })
    })
  })

  it('does not send a duplicate initial OTP when arriving from signup', async () => {
    setSearchParams('fromSignup=true')

    render(<Harness />)

    expect(await screen.findByLabelText('email')).toHaveTextContent('pending@example.com')
    await waitFor(() => {
      expect(screen.getByLabelText('email')).toHaveTextContent('pending@example.com')
    })
    expect(mocks.sendVerificationOtp).not.toHaveBeenCalled()
  })

  it('verifies a complete OTP, clears the stored email, and redirects to workspace', async () => {
    mocks.sendVerificationOtp.mockResolvedValueOnce({})
    mocks.verifyEmail.mockResolvedValueOnce({ data: { success: true } })

    render(<Harness />)

    await screen.findByLabelText('email')
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /fill valid otp/i }))
    expect(screen.getByLabelText('complete')).toHaveTextContent('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))
      await Promise.resolve()
    })

    expect(mocks.verifyEmail).toHaveBeenCalledWith({
      email: 'pending@example.com',
      otp: '123456',
    })
    expect(screen.getByLabelText('verified')).toHaveTextContent('true')
    expect(sessionStorage.getItem('verificationEmail')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(mocks.push).toHaveBeenCalledWith('/w')
  })

  it('surfaces invalid OTP errors and clears the typed code', async () => {
    mocks.sendVerificationOtp.mockResolvedValueOnce({})
    mocks.verifyEmail.mockResolvedValueOnce({ error: { message: 'invalid' } })

    render(<Harness />)

    await screen.findByLabelText('email')
    fireEvent.click(screen.getByRole('button', { name: /fill invalid otp/i }))
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))

    expect(
      await screen.findByText('Invalid verification code. Please check and try again.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('otp')).toHaveTextContent('')
  })

  it('resends the code for the stored email on demand', async () => {
    mocks.sendVerificationOtp.mockResolvedValue({})

    render(<Harness hasResendKey={false} />)

    await screen.findByLabelText('email')
    fireEvent.click(screen.getByRole('button', { name: /resend/i }))

    await waitFor(() => {
      expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'pending@example.com',
        type: 'email-verification',
      })
    })
  })
})
