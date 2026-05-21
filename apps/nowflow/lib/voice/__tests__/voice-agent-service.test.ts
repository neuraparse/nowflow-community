import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type VoiceAgentConfig, VoiceAgentService } from '../voice-agent-service'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

const baseConfig: VoiceAgentConfig = {
  accountSid: 'AC_TEST_SID',
  authToken: 'test_auth_token',
  fromNumber: '+15551230000',
  webhookBaseUrl: 'https://example.com',
  greetingMessage: 'Welcome to the service.',
}

function jsonResponse(body: Record<string, unknown>, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('VoiceAgentService', () => {
  let service: VoiceAgentService

  beforeEach(() => {
    service = new VoiceAgentService(baseConfig)
    mockFetch.mockReset()
  })

  // ── startCall ──────────────────────────────────────────────────────

  describe('startCall', () => {
    it('calls Twilio API with correct URL and auth header', async () => {
      mockFetch.mockReturnValue(jsonResponse({ sid: 'CA_123', status: 'queued' }))

      const result = await service.startCall({ to: '+15559990000' })

      expect(result).toEqual({ success: true, callSid: 'CA_123', status: 'queued' })
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_TEST_SID/Calls.json')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toMatch(/^Basic /)
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    })

    it('builds TwiML URL with greeting and workflowId', async () => {
      mockFetch.mockReturnValue(jsonResponse({ sid: 'CA_456', status: 'queued' }))

      await service.startCall({
        to: '+15559990000',
        greetingMessage: 'Hi there',
        workflowId: 'wf_1',
      })

      const body = new URLSearchParams(mockFetch.mock.calls[0][1].body)
      const twimlUrl = body.get('Url')!
      expect(twimlUrl).toContain('action=greeting')
      expect(twimlUrl).toContain('greeting=' + encodeURIComponent('Hi there'))
      expect(twimlUrl).toContain('workflowId=' + encodeURIComponent('wf_1'))
    })

    it('appends StatusCallback when callbackUrl is provided', async () => {
      mockFetch.mockReturnValue(jsonResponse({ sid: 'CA_789', status: 'queued' }))

      await service.startCall({ to: '+15559990000', callbackUrl: 'https://cb.test/status' })

      const body = new URLSearchParams(mockFetch.mock.calls[0][1].body)
      expect(body.get('StatusCallback')).toBe('https://cb.test/status')
      expect(body.get('StatusCallbackEvent')).toBe('initiated ringing answered completed')
    })

    it('returns error on non-ok response', async () => {
      mockFetch.mockReturnValue(jsonResponse({ message: 'Invalid phone' }, false, 400))

      const result = await service.startCall({ to: 'bad' })

      expect(result).toEqual({ success: false, error: 'Invalid phone' })
    })

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network down'))

      const result = await service.startCall({ to: '+15559990000' })

      expect(result).toEqual({ success: false, error: 'Network down' })
    })
  })

  // ── handleIncomingCall ─────────────────────────────────────────────

  describe('handleIncomingCall', () => {
    it('returns TwiML with the configured greeting', () => {
      const twiml = service.handleIncomingCall()
      expect(twiml).toContain('Welcome to the service.')
      expect(twiml).toContain('<Gather')
      expect(twiml).toContain('<?xml version="1.0"')
    })

    it('uses custom greeting when provided', () => {
      const twiml = service.handleIncomingCall('Custom hello')
      expect(twiml).toContain('Custom hello')
    })

    it('includes workflowId in gather URL', () => {
      const twiml = service.handleIncomingCall(undefined, 'wf_42')
      expect(twiml).toContain('workflowId=' + encodeURIComponent('wf_42'))
    })
  })

  // ── processVoiceInput ──────────────────────────────────────────────

  describe('processVoiceInput', () => {
    it('returns conversation TwiML with AI response', async () => {
      const twiml = await service.processVoiceInput('I need help', 'wf_1', 'CA_1')

      expect(twiml).toContain('I heard you say')
      expect(twiml).toContain('I need help')
      expect(twiml).toContain('<Gather')
      expect(twiml).toContain('action=gather')
    })

    it('includes workflowId in gather URL', async () => {
      const twiml = await service.processVoiceInput('hello', 'wf_99')
      expect(twiml).toContain('workflowId=' + encodeURIComponent('wf_99'))
    })

    it('returns error TwiML when AI processing fails', async () => {
      // Force an error by making getAIResponse throw via prototype override
      const orig = (service as any).getAIResponse.bind(service)
      vi.spyOn(service as any, 'getAIResponse').mockRejectedValue(new Error('AI down'))

      const twiml = await service.processVoiceInput('test')

      expect(twiml).toContain('I encountered an error')
      expect(twiml).toContain('<Gather')

      vi.restoreAllMocks()
    })
  })

  // ── generateTwiML ─────────────────────────────────────────────────

  describe('generateTwiML', () => {
    it('generates greeting TwiML', () => {
      const twiml = service.generateTwiML('greeting', { message: 'Hi', gatherUrl: '/gather' })
      expect(twiml).toContain('<Say voice="Polly.Joanna">Hi</Say>')
      expect(twiml).toContain('action="/gather"')
      expect(twiml).toContain('Please go ahead.')
    })

    it('generates conversation TwiML', () => {
      const twiml = service.generateTwiML('conversation', {
        message: 'Sure thing',
        gatherUrl: '/g',
      })
      expect(twiml).toContain('Sure thing')
      expect(twiml).toContain('Is there anything else?')
    })

    it('generates hold TwiML with music URL', () => {
      const twiml = service.generateTwiML('hold', { holdMusicUrl: 'https://music.test/hold.mp3' })
      expect(twiml).toContain('Please hold')
      expect(twiml).toContain('<Play loop="3">https://music.test/hold.mp3</Play>')
    })

    it('generates voicemail TwiML', () => {
      const twiml = service.generateTwiML('voicemail', { callbackUrl: '/recording' })
      expect(twiml).toContain('leave a message')
      expect(twiml).toContain('<Record')
      expect(twiml).toContain('action="/recording"')
    })

    it('generates transferring TwiML', () => {
      const twiml = service.generateTwiML('transferring', { transferTo: '+15551112222' })
      expect(twiml).toContain('Transferring you now')
      expect(twiml).toContain('<Dial>+15551112222</Dial>')
    })

    it('generates ended TwiML with hangup', () => {
      const twiml = service.generateTwiML('ended', { message: 'Bye!' })
      expect(twiml).toContain('Bye!')
      expect(twiml).toContain('<Hangup/>')
    })

    it('returns hangup-only for unknown state', () => {
      const twiml = service.generateTwiML('unknown' as any)
      expect(twiml).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>')
    })
  })

  // ── transferCall ───────────────────────────────────────────────────

  describe('transferCall', () => {
    it('sends Twiml to modify the call via Twilio API', async () => {
      mockFetch.mockReturnValue(jsonResponse({ sid: 'CA_T1', status: 'in-progress' }))

      const result = await service.transferCall('CA_T1', '+15553334444')

      expect(result).toEqual({ success: true, callSid: 'CA_T1', status: 'transferring' })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_TEST_SID/Calls/CA_T1.json')
      expect(init.method).toBe('POST')

      const body = new URLSearchParams(init.body)
      expect(body.get('Twiml')).toContain('<Dial>+15553334444</Dial>')
    })

    it('returns error on API failure', async () => {
      mockFetch.mockReturnValue(jsonResponse({ message: 'Not found' }, false, 404))

      const result = await service.transferCall('CA_BAD', '+15551110000')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Not found')
    })

    it('returns error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Timeout'))

      const result = await service.transferCall('CA_X', '+15551110000')
      expect(result).toEqual({ success: false, error: 'Timeout' })
    })
  })

  // ── endCall ────────────────────────────────────────────────────────

  describe('endCall', () => {
    it('sends TwiML with farewell and Status=completed', async () => {
      mockFetch.mockReturnValue(jsonResponse({ sid: 'CA_E1', status: 'completed' }))

      const result = await service.endCall('CA_E1', 'See you later!')

      expect(result).toEqual({ success: true, callSid: 'CA_E1', status: 'completed' })

      const body = new URLSearchParams(mockFetch.mock.calls[0][1].body)
      expect(body.get('Twiml')).toContain('See you later!')
      expect(body.get('Status')).toBe('completed')
    })

    it('uses default farewell when none provided', async () => {
      mockFetch.mockReturnValue(jsonResponse({ sid: 'CA_E2', status: 'completed' }))

      await service.endCall('CA_E2')

      const body = new URLSearchParams(mockFetch.mock.calls[0][1].body)
      expect(body.get('Twiml')).toContain('Thank you for calling. Goodbye.')
    })

    it('returns error on API failure', async () => {
      mockFetch.mockReturnValue(jsonResponse({ message: 'Server error' }, false, 500))

      const result = await service.endCall('CA_E3')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Server error')
    })
  })

  // ── XML escaping ───────────────────────────────────────────────────

  describe('XML escaping', () => {
    it('escapes &, <, >, ", and \' in messages', () => {
      const twiml = service.generateTwiML('ended', {
        message: 'Tom & Jerry said "hi" <wave> it\'s great',
      })
      expect(twiml).toContain('Tom &amp; Jerry said &quot;hi&quot; &lt;wave&gt; it&apos;s great')
      expect(twiml).not.toContain('<wave>')
    })

    it('escapes special characters in gather URL', () => {
      const twiml = service.generateTwiML('greeting', {
        message: 'Hello',
        gatherUrl: '/api?a=1&b=2',
      })
      expect(twiml).toContain('action="/api?a=1&amp;b=2"')
    })
  })
})
