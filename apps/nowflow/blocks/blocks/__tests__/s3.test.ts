import { describe, expect, it, vi } from 'vitest'
import { S3Block } from '../s3'

vi.mock('@/components/icons', () => ({ S3Icon: () => null }))

describe('S3Block', () => {
  it('exports a BlockConfig-shaped object with required fields', () => {
    expect(S3Block).toBeDefined()
    expect(typeof S3Block.type).toBe('string')
    expect(S3Block.bgColor).toMatch(/^#[0-9a-fA-F]{3,8}$/)
    expect(Array.isArray(S3Block.subBlocks)).toBe(true)
  })

  it('has type s3', () => {
    expect(S3Block.type).toBe('s3')
  })

  it('exposes s3_get_object tool access', () => {
    expect(S3Block.tools.access).toContain('s3_get_object')
    expect(S3Block.tools.config!.tool({})).toBe('s3_get_object')
  })

  describe('params transformer', () => {
    const params = S3Block.tools.config!.params!

    it('parses standard virtual-hosted-style URL with region', () => {
      const result = params({
        accessKeyId: 'AKIA',
        secretAccessKey: 'sec',
        s3Uri: 'https://my-bucket.s3.eu-west-1.amazonaws.com/path/to/file.txt',
      })
      expect(result.bucketName).toBe('my-bucket')
      expect(result.region).toBe('eu-west-1')
      expect(result.objectKey).toBe('path/to/file.txt')
      expect(result.accessKeyId).toBe('AKIA')
      expect(result.secretAccessKey).toBe('sec')
    })

    it('defaults region to us-east-1 when no region in hostname', () => {
      const result = params({
        accessKeyId: 'AKIA',
        secretAccessKey: 'sec',
        s3Uri: 'https://my-bucket.s3.amazonaws.com/file.txt',
      })
      expect(result.bucketName).toBe('my-bucket')
      expect(result.region).toBe('us-east-1')
      expect(result.objectKey).toBe('file.txt')
    })

    it('throws when accessKeyId missing', () => {
      expect(() =>
        params({ secretAccessKey: 'sec', s3Uri: 'https://b.s3.amazonaws.com/x' })
      ).toThrow(/Access Key ID is required/)
    })

    it('throws when secretAccessKey missing', () => {
      expect(() => params({ accessKeyId: 'AKIA', s3Uri: 'https://b.s3.amazonaws.com/x' })).toThrow(
        /Secret Access Key is required/
      )
    })

    it('throws when s3Uri missing', () => {
      expect(() => params({ accessKeyId: 'AKIA', secretAccessKey: 'sec' })).toThrow(
        /S3 Object URL is required/
      )
    })

    it('throws when URL is malformed', () => {
      expect(() =>
        params({ accessKeyId: 'AKIA', secretAccessKey: 'sec', s3Uri: 'not a url' })
      ).toThrow(/Invalid S3 Object URL format/)
    })
  })
})
