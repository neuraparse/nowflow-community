/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ToolTester } from '../__test-utils__/test-tools'
import { outlookCalendarTool } from './calendar'

describe('Outlook Calendar Tool', () => {
  let tester: ToolTester<any>

  beforeEach(() => {
    tester = new ToolTester(outlookCalendarTool)
  })

  afterEach(() => {
    tester.cleanup()
    vi.resetAllMocks()
  })

  describe('URL construction', () => {
    test('list default calendar with time range', () => {
      const url = tester.getRequestUrl({
        accessToken: 't',
        operation: 'list',
        timeMin: '2025-01-01T00:00:00Z',
        timeMax: '2025-01-31T23:59:59Z',
      })
      expect(url).toContain('https://graph.microsoft.com/v1.0/me/events')
      // Allow URLSearchParams + encoding for spaces
      expect(url).toContain('$filter=')
      expect(url).toContain('2025-01-01T00:00:00Z')
      expect(url).toContain('2025-01-31T23:59:59Z')
    })

    test('get event by id', () => {
      const url = tester.getRequestUrl({ accessToken: 't', operation: 'get', eventId: 'e' })
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/events/e')
    })

    test('create event custom calendar', () => {
      const url = tester.getRequestUrl({ accessToken: 't', operation: 'create', calendarId: 'cal' })
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/calendars/cal/events')
    })
  })

  describe('Headers', () => {
    test('auth header included', () => {
      const headers = tester.getRequestHeaders({ accessToken: 'tok', operation: 'list' })
      expect(headers.Authorization).toBe('Bearer tok')
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('Transform', () => {
    test('success json', async () => {
      tester.setup({ value: 1 })
      const res = await tester.execute({ accessToken: 't', operation: 'list' })
      expect(res.success).toBe(true)
    })

    test('error json', async () => {
      tester.setup({ error: { message: 'Bad' } }, { ok: false, status: 400 })
      const res = await tester.execute({ accessToken: 't', operation: 'list' })
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
    })
  })
})
