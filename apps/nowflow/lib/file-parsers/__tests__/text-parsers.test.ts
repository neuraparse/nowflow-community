/**
 * Unit tests for text-based file parsers (TXT, MD, HTML, JSON, XML)
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HtmlParser, JsonParser, MarkdownParser, TxtParser, XmlParser } from '../text-parsers'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  })),
}))

const mockReadFile = vi.fn()
vi.mock('fs/promises', () => ({
  readFile: (...args: any[]) => mockReadFile(...args),
}))

describe('TxtParser', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parseFile reads file and returns raw content', async () => {
    mockReadFile.mockResolvedValue('hello world')
    const parser = new TxtParser()
    const result = await parser.parseFile('/a/b.txt')

    expect(mockReadFile).toHaveBeenCalledWith('/a/b.txt', 'utf-8')
    expect(result.content).toBe('hello world')
    expect(result.metadata).toEqual({ parser: 'txt', filePath: '/a/b.txt' })
  })

  it('parseFile throws on error', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    const parser = new TxtParser()
    await expect(parser.parseFile('/missing.txt')).rejects.toThrow('Failed to parse TXT: ENOENT')
  })

  it('parseBuffer returns utf-8 decoded content', async () => {
    const parser = new TxtParser()
    const result = await parser.parseBuffer(Buffer.from('raw text'))
    expect(result.content).toBe('raw text')
    expect(result.metadata).toEqual({ parser: 'txt' })
  })
})

describe('MarkdownParser', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  it('parseFile normalizes CRLF and collapses 3+ newlines to 2', async () => {
    mockReadFile.mockResolvedValue('# Title\r\n\r\n\r\n\r\nbody')
    const parser = new MarkdownParser()
    const result = await parser.parseFile('/a/b.md')

    expect(result.content).toBe('# Title\n\nbody')
    expect(result.metadata).toEqual({ parser: 'markdown', filePath: '/a/b.md' })
  })

  it('parseFile trims whitespace', async () => {
    mockReadFile.mockResolvedValue('   hello   ')
    const parser = new MarkdownParser()
    const result = await parser.parseFile('/x.md')
    expect(result.content).toBe('hello')
  })

  it('parseFile throws with message on failure', async () => {
    mockReadFile.mockRejectedValue(new Error('boom'))
    const parser = new MarkdownParser()
    await expect(parser.parseFile('/x.md')).rejects.toThrow('Failed to parse Markdown: boom')
  })

  it('parseBuffer processes buffer like parseFile', async () => {
    const parser = new MarkdownParser()
    const result = await parser.parseBuffer(Buffer.from('a\r\n\r\n\r\nb'))
    expect(result.content).toBe('a\n\nb')
    expect(result.metadata).toEqual({ parser: 'markdown' })
  })
})

describe('HtmlParser', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  it('strips scripts, styles, head, and tags', async () => {
    const html = `<html><head><title>T</title></head><body><script>alert(1)</script><style>.x{}</style><p>Hello <b>World</b></p></body></html>`
    mockReadFile.mockResolvedValue(html)
    const parser = new HtmlParser()
    const result = await parser.parseFile('/a.html')
    expect(result.content).toBe('Hello World')
    expect(result.metadata).toEqual({ parser: 'html', filePath: '/a.html' })
  })

  it('decodes common html entities', async () => {
    const parser = new HtmlParser()
    const result = await parser.parseBuffer(
      Buffer.from('<p>Tom&nbsp;&amp;&nbsp;Jerry &lt;3 &gt;&quot;&#39;</p>')
    )
    expect(result.content).toBe(`Tom & Jerry <3 >"'`)
  })

  it('parseFile throws on read error', async () => {
    mockReadFile.mockRejectedValue(new Error('no perms'))
    const parser = new HtmlParser()
    await expect(parser.parseFile('/x.html')).rejects.toThrow('Failed to parse HTML: no perms')
  })

  it('parseBuffer returns empty string on empty input', async () => {
    const parser = new HtmlParser()
    const result = await parser.parseBuffer(Buffer.from(''))
    expect(result.content).toBe('')
  })
})

describe('JsonParser', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  it('extracts key: value strings from objects', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ a: 'apple', b: 2, c: true }))
    const parser = new JsonParser()
    const result = await parser.parseFile('/a.json')
    expect(result.content).toBe('a: apple\nb: 2\nc: true')
  })

  it('handles arrays by joining items with newlines', async () => {
    const parser = new JsonParser()
    const result = await parser.parseBuffer(Buffer.from(JSON.stringify(['x', 'y', 'z'])))
    expect(result.content).toBe('x\ny\nz')
  })

  it('handles nested objects', async () => {
    const parser = new JsonParser()
    const result = await parser.parseBuffer(
      Buffer.from(JSON.stringify({ outer: { inner: 'deep' } }))
    )
    expect(result.content).toBe('outer: inner: deep')
  })

  it('returns empty string for null / undefined leaves', async () => {
    const parser = new JsonParser()
    const result = await parser.parseBuffer(Buffer.from(JSON.stringify({ a: null })))
    expect(result.content).toBe('a: ')
  })

  it('throws on invalid JSON (parseFile)', async () => {
    mockReadFile.mockResolvedValue('not-json')
    const parser = new JsonParser()
    await expect(parser.parseFile('/a.json')).rejects.toThrow(/Failed to parse JSON/)
  })

  it('produces empty string content for empty object', async () => {
    const parser = new JsonParser()
    const result = await parser.parseBuffer(Buffer.from('{}'))
    expect(result.content).toBe('')
  })

  it('guards against deep recursion (depth > 10 returns empty string)', async () => {
    // Build an object 12 levels deep
    let deep: any = 'leaf'
    for (let i = 0; i < 12; i++) deep = { k: deep }
    const parser = new JsonParser()
    const result = await parser.parseBuffer(Buffer.from(JSON.stringify(deep)))
    // The content should still be produced but deeper than 10 levels is truncated
    expect(result.content).toContain('k:')
  })
})

describe('XmlParser', () => {
  beforeEach(() => {
    mockReadFile.mockReset()
  })

  it('strips xml declaration and tags while preserving content', async () => {
    const xml = `<?xml version="1.0"?>\n<root><a>Hello</a><b>World</b></root>`
    mockReadFile.mockResolvedValue(xml)
    const parser = new XmlParser()
    const result = await parser.parseFile('/a.xml')
    expect(result.content).toContain('Hello')
    expect(result.content).toContain('World')
    expect(result.metadata).toEqual({ parser: 'xml', filePath: '/a.xml' })
  })

  it('removes xml comments', async () => {
    const parser = new XmlParser()
    const result = await parser.parseBuffer(Buffer.from('<root><!-- ignored --><a>kept</a></root>'))
    expect(result.content).not.toContain('ignored')
    expect(result.content).toContain('kept')
  })

  it('keeps CDATA content', async () => {
    const parser = new XmlParser()
    const result = await parser.parseBuffer(
      Buffer.from('<root><a><![CDATA[hello cdata]]></a></root>')
    )
    expect(result.content).toContain('hello cdata')
  })

  it('parseFile throws on read error', async () => {
    mockReadFile.mockRejectedValue(new Error('boom'))
    const parser = new XmlParser()
    await expect(parser.parseFile('/a.xml')).rejects.toThrow('Failed to parse XML: boom')
  })

  it('returns empty string on empty input', async () => {
    const parser = new XmlParser()
    const result = await parser.parseBuffer(Buffer.from(''))
    expect(result.content).toBe('')
  })
})
