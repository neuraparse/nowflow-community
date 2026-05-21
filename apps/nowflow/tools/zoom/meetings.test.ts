/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ToolTester } from '../__test-utils__/test-tools'
import { zoomMeetingsTool } from './meetings'

describe('Zoom Meetings Tool', () => {
  let tester: ToolTester<any>

  beforeEach(() => {
    tester = new ToolTester(zoomMeetingsTool)
  })

  afterEach(() => {
    tester.cleanup()
    vi.resetAllMocks()
  })

  describe('URL construction', () => {
    test('list with type filter', () => {
      const url = tester.getRequestUrl({ token: 't', operation: 'list', type: 'upcoming' })
      expect(url).toBe('https://api.zoom.us/v2/users/me/meetings?type=upcoming')
    })

    test('get meeting by id', () => {
      const url = tester.getRequestUrl({ token: 't', operation: 'get', meetingId: '123' })
      expect(url).toBe('https://api.zoom.us/v2/meetings/123')
    })

    test('create meeting', () => {
      const url = tester.getRequestUrl({ token: 't', operation: 'create' })
      expect(url).toBe('https://api.zoom.us/v2/users/me/meetings')
    })
  })

  describe('Headers', () => {
    test('auth header included', () => {
      const headers = tester.getRequestHeaders({ token: 'abc', operation: 'list' })
      expect(headers.Authorization).toBe('Bearer abc')
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('Transform', () => {
    test('success json', async () => {
      tester.setup({ ok: true })
      const res = await tester.execute({ token: 't', operation: 'list' })
      expect(res.success).toBe(true)
    })

    test('error json', async () => {
      tester.setup({ message: 'Invalid' }, { ok: false, status: 400 })
      const res = await tester.execute({ token: 't', operation: 'list' })
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
    })
  })
})
