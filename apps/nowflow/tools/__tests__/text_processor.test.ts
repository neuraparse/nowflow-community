import { describe, expect, it, vi } from 'vitest'
import { textProcessorTool } from '../text_processor/tool'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const exec = (params: any) => (textProcessorTool as any).directExecution(params)

describe('textProcessorTool config', () => {
  it('has expected metadata', () => {
    expect(textProcessorTool.id).toBe('text_processor')
    expect(textProcessorTool.name).toBe('Text Processor')
    expect(typeof textProcessorTool.directExecution).toBe('function')
  })
})

describe('textProcessorTool directExecution', () => {
  it('cleans excessive whitespace', async () => {
    const result = await exec({ inputText: '  hello    world  ', operation: 'clean' })
    expect(result.output.processedText).toBe('hello world')
  })

  it('applies uppercase transform', async () => {
    const result = await exec({
      inputText: 'hello',
      operation: 'clean',
      caseTransform: 'upper',
    })
    expect(result.output.processedText).toBe('HELLO')
  })

  it('applies snake_case transform', async () => {
    const result = await exec({
      inputText: 'Hello World Here',
      operation: 'clean',
      caseTransform: 'snake',
    })
    expect(result.output.processedText).toBe('hello_world_here')
  })

  it('applies kebab-case transform', async () => {
    const result = await exec({
      inputText: 'Hello World',
      operation: 'clean',
      caseTransform: 'kebab',
    })
    expect(result.output.processedText).toBe('hello-world')
  })

  it('extracts emails', async () => {
    const result = await exec({
      inputText: 'Contact me at foo@bar.com or baz@qux.io',
      operation: 'extract_emails',
    })
    const lines = result.output.processedText.split('\n')
    expect(lines).toEqual(['foo@bar.com', 'baz@qux.io'])
    expect(result.output.metadata.extractedCount).toBe(2)
  })

  it('extracts URLs', async () => {
    const result = await exec({
      inputText: 'Visit https://example.com and http://foo.bar',
      operation: 'extract_urls',
    })
    expect(result.output.metadata.extractedCount).toBeGreaterThanOrEqual(2)
  })

  it('splits with delimiter and max', async () => {
    const result = await exec({
      inputText: 'a,b,c,d',
      operation: 'split',
      splitDelimiter: ',',
      maxSplits: 2,
    })
    expect(result.output.processedText.split('\n')).toEqual(['a', 'b'])
    expect(result.output.metadata.splitCount).toBe(2)
  })

  it('replaces matching substrings', async () => {
    const result = await exec({
      inputText: 'foo bar foo',
      operation: 'replace',
      searchText: 'foo',
      replaceText: 'baz',
    })
    expect(result.output.processedText).toBe('baz bar baz')
  })

  it('regex match returns all matches joined by newlines', async () => {
    const result = await exec({
      inputText: 'a1 b2 c3',
      operation: 'regex_match',
      searchText: '\\d',
    })
    expect(result.output.processedText).toBe('1\n2\n3')
    expect(result.output.metadata.matchCount).toBe(3)
  })

  it('analyze reports word/sentence counts', async () => {
    const result = await exec({
      inputText: 'Hello world. This is a test.',
      operation: 'analyze',
    })
    expect(result.output.metadata.analysis.wordCount).toBeGreaterThan(0)
    expect(result.output.metadata.analysis.sentenceCount).toBe(2)
  })

  it('trims when trimWhitespace is true', async () => {
    const result = await exec({
      inputText: '   hello   ',
      operation: 'format',
      trimWhitespace: true,
    })
    expect(result.output.processedText).toBe('hello')
  })

  it('reports wordCount and characterCount correctly', async () => {
    const result = await exec({ inputText: 'one two three', operation: 'format' })
    expect(result.output.wordCount).toBe(3)
    expect(result.output.characterCount).toBe('one two three'.length)
  })

  it('handles empty input gracefully', async () => {
    const result = await exec({ inputText: '', operation: 'clean' })
    expect(result.success).toBe(true)
    expect(result.output.processedText).toBe('')
  })
})
