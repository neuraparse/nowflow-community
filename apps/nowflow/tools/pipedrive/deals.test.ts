/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ToolTester } from '../__test-utils__/test-tools'
import { pipedriveDealsTool } from './deals'

describe('Pipedrive Deals Tool', () => {
  let tester: ToolTester<any>

  beforeEach(() => {
    tester = new ToolTester(pipedriveDealsTool)
  })

  afterEach(() => {
    tester.cleanup()
    vi.resetAllMocks()
  })

  describe('URL construction', () => {
    test('list with default base and search', () => {
      const url = tester.getRequestUrl({ apiToken: 'tok', operation: 'list', search: 'foo' })
      expect(url).toBe('https://api.pipedrive.com/v1/deals?api_token=tok&term=foo')
    })

    test('get by id with custom base', () => {
      const url = tester.getRequestUrl({
        apiToken: 'X',
        baseUrl: 'https://custom',
        operation: 'get',
        dealId: '1',
      })
      expect(url).toBe('https://custom/deals/1?api_token=X')
    })

    test('create url', () => {
      const url = tester.getRequestUrl({ apiToken: 't', operation: 'create', data: { title: 'A' } })
      expect(url).toBe('https://api.pipedrive.com/v1/deals?api_token=t')
    })
  })

  describe('Headers', () => {
    test('content type only', () => {
      const headers = tester.getRequestHeaders({ apiToken: 't', operation: 'create', data: {} })
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('Transform', () => {
    test('success', async () => {
      tester.setup({ data: { id: 1 } })
      const res = await tester.execute({ apiToken: 't', operation: 'list' })
      expect(res.success).toBe(true)
    })

    test('error', async () => {
      tester.setup({ error: 'Oops' }, { ok: false, status: 400 })
      const res = await tester.execute({ apiToken: 't', operation: 'list' })
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
    })
  })
})
