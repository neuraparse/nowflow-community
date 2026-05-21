import { describe, expect, it, vi } from 'vitest'
import { FileOperationsBlock } from '../file_operations'

vi.mock('@/components/icons', () => ({ FileIcon: () => null }))

describe('FileOperationsBlock', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(FileOperationsBlock).toBeDefined()
    expect(FileOperationsBlock.type).toBe('file_operations')
    expect(FileOperationsBlock.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(FileOperationsBlock.subBlocks)).toBe(true)
  })

  it('exposes file_operations tool access', () => {
    expect(FileOperationsBlock.tools.access).toContain('file_operations')
    expect(FileOperationsBlock.tools.config!.tool({})).toBe('file_operations')
  })

  describe('params transformer', () => {
    const params = FileOperationsBlock.tools.config!.params!

    it('maps filePath for read operation', () => {
      const result = params({ operation: 'read', filePath: '/a/b.txt', fileFormat: 'text' })
      expect(result.operation).toBe('read')
      expect(result.path).toBe('/a/b.txt')
      expect(result.encoding).toBe('utf8')
    })

    it('maps directoryPath for list operation', () => {
      const result = params({ operation: 'list', directoryPath: '/dir', recursive: true })
      expect(result.path).toBe('/dir')
      expect(result.recursive).toBe(true)
    })

    it('parses JSON content string for write json', () => {
      const result = params({
        operation: 'write',
        filePath: '/data.json',
        fileFormat: 'json',
        jsonContent: '{"a":1}',
      })
      expect(result.format).toBe('json')
      expect(result.content).toEqual({ a: 1 })
    })

    it('uses csvContent for csv writes', () => {
      const result = params({
        operation: 'append',
        filePath: '/d.csv',
        fileFormat: 'csv',
        csvContent: 'a,b\n1,2',
      })
      expect(result.format).toBe('csv')
      expect(result.content).toBe('a,b\n1,2')
    })

    it('defaults operation to read when missing', () => {
      const result = params({})
      expect(result.operation).toBe('read')
    })
  })
})
