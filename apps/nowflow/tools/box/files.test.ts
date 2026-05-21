/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ToolTester } from '../__test-utils__/test-tools'
import { boxFilesTool } from './files'

describe('Box Files Tool', () => {
  let tester: ToolTester<any>

  beforeEach(() => {
    tester = new ToolTester(boxFilesTool)
  })

  afterEach(() => {
    tester.cleanup()
    vi.resetAllMocks()
  })

  describe('URL construction', () => {
    test('list root folder items', () => {
      const url = tester.getRequestUrl({ apiToken: 't', operation: 'list' })
      expect(url).toBe('https://api.box.com/2.0/folders/0/items')
    })

    test('download by id', () => {
      const url = tester.getRequestUrl({ apiToken: 't', operation: 'download', fileId: 'f' })
      expect(url).toBe('https://api.box.com/2.0/files/f/content')
    })

    test('upload endpoint', () => {
      const url = tester.getRequestUrl({ apiToken: 't', operation: 'upload', path: 'a.txt' })
      expect(url).toBe('https://upload.box.com/api/2.0/files/content')
    })
  })

  describe('Headers', () => {
    test('auth header included', () => {
      const headers = tester.getRequestHeaders({ apiToken: 'tok', operation: 'list' })
      expect(headers.Authorization).toBe('Bearer tok')
    })
  })

  describe('Transform', () => {
    test('success json', async () => {
      tester.setup({ value: 1 })
      const res = await tester.execute({ apiToken: 't', operation: 'list' })
      expect(res.success).toBe(true)
    })

    test('error json', async () => {
      tester.setup({ message: 'Bad' }, { ok: false, status: 400 })
      const res = await tester.execute({ apiToken: 't', operation: 'list' })
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
    })
  })
})
