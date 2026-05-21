/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ToolTester } from '../__test-utils__/test-tools'
import { sharepointListsTool } from './lists'

describe('SharePoint Lists Tool', () => {
  let tester: ToolTester<any>

  beforeEach(() => {
    tester = new ToolTester(sharepointListsTool)
  })

  afterEach(() => {
    tester.cleanup()
    vi.resetAllMocks()
  })

  describe('URL construction', () => {
    test('list lists', () => {
      const url = tester.getRequestUrl({
        accessToken: 't',
        operation: 'list_lists',
        siteId: 'site',
      })
      expect(url).toBe('https://graph.microsoft.com/v1.0/sites/site/lists')
    })

    test('list items', () => {
      const url = tester.getRequestUrl({
        accessToken: 't',
        operation: 'list_items',
        siteId: 's',
        listId: 'l',
      })
      expect(url).toBe('https://graph.microsoft.com/v1.0/sites/s/lists/l/items?expand=fields')
    })

    test('get item', () => {
      const url = tester.getRequestUrl({
        accessToken: 't',
        operation: 'get_item',
        siteId: 's',
        listId: 'l',
        itemId: 'i',
      })
      expect(url).toBe('https://graph.microsoft.com/v1.0/sites/s/lists/l/items/i?expand=fields')
    })
  })

  describe('Headers', () => {
    test('auth header included', () => {
      const headers = tester.getRequestHeaders({
        accessToken: 'tok',
        operation: 'list_lists',
        siteId: 's',
      })
      expect(headers.Authorization).toBe('Bearer tok')
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('Transform', () => {
    test('success json', async () => {
      tester.setup({ value: 1 })
      const res = await tester.execute({ accessToken: 't', operation: 'list_lists', siteId: 's' })
      expect(res.success).toBe(true)
    })

    test('error json', async () => {
      tester.setup({ error: { message: 'Bad' } }, { ok: false, status: 400 })
      const res = await tester.execute({ accessToken: 't', operation: 'list_lists', siteId: 's' })
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
    })
  })
})
