/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ToolTester } from '../__test-utils__/test-tools'
import { oneDriveFilesTool } from './files'

describe('OneDrive Files Tool', () => {
  let tester: ToolTester<any>

  beforeEach(() => {
    tester = new ToolTester(oneDriveFilesTool)
  })

  afterEach(() => {
    tester.cleanup()
    vi.resetAllMocks()
  })

  describe('URL construction', () => {
    test('list root children', () => {
      const url = tester.getRequestUrl({ accessToken: 't', operation: 'list' })
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/root/children')
    })

    test('list by path', () => {
      const url = tester.getRequestUrl({ accessToken: 't', operation: 'list', path: '/Docs' })
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/root:/Docs:/children')
    })

    test('download by itemId', () => {
      const url = tester.getRequestUrl({ accessToken: 't', operation: 'download', itemId: 'it' })
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/it/content')
    })

    test('upload by path', () => {
      const url = tester.getRequestUrl({ accessToken: 't', operation: 'upload', path: '/a.txt' })
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/root:/a.txt:/content')
    })
  })

  describe('Headers', () => {
    test('auth and content-type', () => {
      const headers = tester.getRequestHeaders({
        accessToken: 'X',
        operation: 'upload',
        path: '/a',
        contentType: 'text/plain',
      })
      expect(headers.Authorization).toBe('Bearer X')
    })
  })

  describe('Transform', () => {
    test('success', async () => {
      tester.setup({ value: 1 })
      const res = await tester.execute({ accessToken: 't', operation: 'list' })
      expect(res.success).toBe(true)
    })

    test('error path', async () => {
      tester.setup({ error: { message: 'Bad' } }, { ok: false, status: 400 })
      const res = await tester.execute({ accessToken: 't', operation: 'list' })
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
    })
  })
})
