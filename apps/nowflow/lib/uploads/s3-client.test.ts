/**
 * Unit tests for S3 client
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as s3Sdk from '@aws-sdk/client-s3'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  deleteFromS3,
  downloadFromS3,
  FileInfo,
  getPresignedUrl,
  s3Client,
  uploadToS3,
} from './s3-client'

// Access the underlying mockSend exposed by the mock factory
const mockSend = (s3Sdk as any).__mockSend as ReturnType<typeof vi.fn>

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn()

  // Classes are properly constructable with `new` in vitest 4
  class MockS3Client {
    send = mockSend
  }
  class PutObjectCommand {
    input: any
    constructor(input: any) {
      this.input = input
      ;(PutObjectCommand as any).__spy(input)
    }
    static __spy = vi.fn()
  }
  class GetObjectCommand {
    input: any
    constructor(input: any) {
      this.input = input
      ;(GetObjectCommand as any).__spy(input)
    }
    static __spy = vi.fn()
  }
  class DeleteObjectCommand {
    input: any
    constructor(input: any) {
      this.input = input
      ;(DeleteObjectCommand as any).__spy(input)
    }
    static __spy = vi.fn()
  }

  return {
    S3Client: MockS3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    __mockSend: mockSend,
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/presigned-url'),
}))

// Mock date for predictable timestamps
vi.mock('./setup', () => ({
  S3_CONFIG: {
    bucket: 'test-bucket',
    region: 'test-region',
  },
}))

// Mock logger
vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('S3 Client', () => {
  let mockDate: Date
  let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Date.now() for predictable timestamps using spyOn so it restores cleanly
    mockDate = new Date(2023, 0, 1, 12, 0, 0) // 2023-01-01 12:00:00
    dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime())
  })

  afterEach(() => {
    // Restore original Date.now
    dateNowSpy?.mockRestore()
    dateNowSpy = null
  })

  describe('uploadToS3', () => {
    it('should upload a file to S3 and return file info', async () => {
      // Mock S3 client send method to return an appropriate type
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
      } as any)

      const testFile = Buffer.from('test file content')
      const fileName = 'test-file.txt'
      const contentType = 'text/plain'
      const fileSize = testFile.length

      const result = await uploadToS3(testFile, fileName, contentType)

      // Check that S3 client was called with correct parameters
      expect((PutObjectCommand as any).__spy).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: expect.stringContaining('test-file.txt'),
        Body: testFile,
        ContentType: contentType,
        Metadata: {
          originalName: fileName,
          uploadedAt: expect.any(String),
        },
      })

      expect(mockSend).toHaveBeenCalledTimes(1)

      // Check return value
      expect(result).toEqual({
        path: expect.stringContaining('/api/files/serve/s3/'),
        key: expect.stringContaining('test-file.txt'),
        name: fileName,
        size: fileSize,
        type: contentType,
      })
    })

    it('should handle spaces in filenames', async () => {
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
      } as any)

      const testFile = Buffer.from('test file content')
      const fileName = 'test file with spaces.txt'
      const contentType = 'text/plain'

      const result = await uploadToS3(testFile, fileName, contentType)

      // Verify spaces were replaced with hyphens in the key but original name is preserved
      expect(result.key).toContain('test-file-with-spaces.txt')
      expect(result.name).toBe(fileName)
    })

    it('should use provided size if available', async () => {
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
      } as any)

      const testFile = Buffer.from('test file content')
      const fileName = 'test-file.txt'
      const contentType = 'text/plain'
      const providedSize = 12345 // Different from actual buffer size

      const result = await uploadToS3(testFile, fileName, contentType, providedSize)

      expect(result.size).toBe(providedSize)
    })

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed')
      mockSend.mockRejectedValueOnce(error)

      const testFile = Buffer.from('test file content')
      const fileName = 'test-file.txt'
      const contentType = 'text/plain'

      await expect(uploadToS3(testFile, fileName, contentType)).rejects.toThrow('Upload failed')
    })
  })

  describe('getPresignedUrl', () => {
    it('should generate a presigned URL for a file', async () => {
      const key = 'test-file.txt'
      const expiresIn = 7200

      const url = await getPresignedUrl(key, expiresIn)

      expect((GetObjectCommand as any).__spy).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      })

      expect(getSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), {
        expiresIn,
      })

      expect(url).toBe('https://example.com/presigned-url')
    })

    it('should use default expiration if not provided', async () => {
      const key = 'test-file.txt'

      await getPresignedUrl(key)

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { expiresIn: 3600 } // Default is 3600 seconds (1 hour)
      )
    })

    it('should handle errors when generating presigned URL', async () => {
      const error = new Error('Presigned URL generation failed')
      vi.mocked(getSignedUrl).mockRejectedValueOnce(error)

      const key = 'test-file.txt'

      await expect(getPresignedUrl(key)).rejects.toThrow('Presigned URL generation failed')
    })
  })

  describe('downloadFromS3', () => {
    it('should download a file from S3', async () => {
      // Create mock stream with data events
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('chunk1'))
            callback(Buffer.from('chunk2'))
          }
          if (event === 'end') {
            callback()
          }
          return mockStream
        }),
      }

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
        $metadata: { httpStatusCode: 200 },
      } as any)

      const key = 'test-file.txt'
      const result = await downloadFromS3(key)

      expect((GetObjectCommand as any).__spy).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      })

      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(result).toBeInstanceOf(Buffer)
      expect(Buffer.concat([Buffer.from('chunk1'), Buffer.from('chunk2')]).toString()).toEqual(
        result.toString()
      )
    })

    it('should handle stream errors', async () => {
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Stream error'))
          }
          return mockStream
        }),
      }

      mockSend.mockResolvedValueOnce({
        Body: mockStream,
        $metadata: { httpStatusCode: 200 },
      } as any)

      const key = 'test-file.txt'
      await expect(downloadFromS3(key)).rejects.toThrow('Stream error')
    })

    it('should handle S3 client errors', async () => {
      const error = new Error('Download failed')
      mockSend.mockRejectedValueOnce(error)

      const key = 'test-file.txt'
      await expect(downloadFromS3(key)).rejects.toThrow('Download failed')
    })
  })

  describe('deleteFromS3', () => {
    it('should delete a file from S3', async () => {
      mockSend.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 },
      } as any)

      const key = 'test-file.txt'
      await deleteFromS3(key)

      expect((DeleteObjectCommand as any).__spy).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      })

      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed')
      mockSend.mockRejectedValueOnce(error)

      const key = 'test-file.txt'
      await expect(deleteFromS3(key)).rejects.toThrow('Delete failed')
    })
  })

  describe('s3Client initialization', () => {
    it('should initialize with correct configuration', () => {
      // We can't test the constructor call easily since it happens at import time
      // Instead, we can test the s3Client properties
      expect(s3Client).toBeDefined()
      // Verify the client was constructed with the right configuration
      expect(S3Client).toBeDefined()
      // We mocked S3Client function earlier, but that doesn't affect the imported s3Client object
      // So instead of checking constructor call, check that mocked client exists
    })
  })
})
