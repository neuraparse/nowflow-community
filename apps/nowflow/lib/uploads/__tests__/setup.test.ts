/**
 * Unit tests for uploads setup helpers
 *
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  })),
}))

vi.mock('@/lib/environment', () => ({
  isProd: false,
  isDev: true,
  isTest: false,
}))

// Mock fs and fs/promises
const mockExistsSync = vi.fn()
const mockMkdir = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
}))

vi.mock('fs/promises', () => ({
  mkdir: (...args: any[]) => mockMkdir(...args),
}))

describe('uploads setup', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    mockExistsSync.mockReset()
    mockMkdir.mockReset()

    // Reset env
    delete process.env.USE_S3
    delete process.env.UPLOAD_DIR
    delete process.env.S3_BUCKET_NAME
    delete process.env.AWS_REGION
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('USE_S3_STORAGE constant', () => {
    it('is true when USE_S3 env is "true"', async () => {
      process.env.USE_S3 = 'true'
      const mod = await import('../setup')
      expect(mod.USE_S3_STORAGE).toBe(true)
    })

    it('is false when USE_S3 env is not set', async () => {
      const mod = await import('../setup')
      expect(mod.USE_S3_STORAGE).toBe(false)
    })

    it('is false when USE_S3 env is any value other than "true"', async () => {
      process.env.USE_S3 = 'yes'
      const mod = await import('../setup')
      expect(mod.USE_S3_STORAGE).toBe(false)
    })
  })

  describe('UPLOAD_DIR constant', () => {
    it('uses UPLOAD_DIR env when provided', async () => {
      process.env.UPLOAD_DIR = '/custom/upload/dir'
      const mod = await import('../setup')
      expect(mod.UPLOAD_DIR).toBe('/custom/upload/dir')
    })

    it('defaults to project-root/uploads when env not provided', async () => {
      const mod = await import('../setup')
      expect(mod.UPLOAD_DIR).toMatch(/uploads$/)
    })
  })

  describe('S3_CONFIG constant', () => {
    it('reads bucket and region from env', async () => {
      process.env.S3_BUCKET_NAME = 'my-bucket'
      process.env.AWS_REGION = 'eu-west-1'
      const mod = await import('../setup')
      expect(mod.S3_CONFIG).toEqual({
        bucket: 'my-bucket',
        region: 'eu-west-1',
      })
    })

    it('defaults to empty strings when env not set', async () => {
      const mod = await import('../setup')
      expect(mod.S3_CONFIG).toEqual({
        bucket: '',
        region: '',
      })
    })
  })

  describe('ensureUploadsDirectory', () => {
    it('returns true immediately and skips filesystem work when S3 is enabled', async () => {
      process.env.USE_S3 = 'true'
      const { ensureUploadsDirectory } = await import('../setup')

      const result = await ensureUploadsDirectory()

      expect(result).toBe(true)
      expect(mockExistsSync).not.toHaveBeenCalled()
      expect(mockMkdir).not.toHaveBeenCalled()
    })

    it('creates the directory when it does not exist', async () => {
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockResolvedValue(undefined)
      const { ensureUploadsDirectory, UPLOAD_DIR } = await import('../setup')

      const result = await ensureUploadsDirectory()

      expect(result).toBe(true)
      expect(mockExistsSync).toHaveBeenCalledWith(UPLOAD_DIR)
      expect(mockMkdir).toHaveBeenCalledWith(UPLOAD_DIR, { recursive: true })
    })

    it('returns true without creating when directory already exists', async () => {
      mockExistsSync.mockReturnValue(true)
      const { ensureUploadsDirectory } = await import('../setup')

      const result = await ensureUploadsDirectory()

      expect(result).toBe(true)
      expect(mockMkdir).not.toHaveBeenCalled()
    })

    it('returns false when mkdir throws', async () => {
      mockExistsSync.mockReturnValue(false)
      mockMkdir.mockRejectedValue(new Error('EACCES'))
      const { ensureUploadsDirectory } = await import('../setup')

      const result = await ensureUploadsDirectory()

      expect(result).toBe(false)
    })
  })
})
