'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle, FileText, Loader2, Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('UploadDocumentsModal')

const ACCEPTED_FILE_TYPES = [
  '.pdf',
  '.txt',
  '.md',
  '.markdown',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.json',
  '.html',
  '.htm',
]

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

type ProcessingStep = 'idle' | 'uploading' | 'complete' | 'error'

interface UploadResult {
  name: string
  documentId?: string
  status?: string
  error?: string
}

interface UploadDocumentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceId: string
  sourceName: string
  onSuccess: () => void
}

export function UploadDocumentsModal({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  onSuccess,
}: UploadDocumentsModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<UploadResult[]>([])
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('idle')
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    if (open) {
      setFiles([])
      setResults([])
      setProgress(0)
      setCurrentStep('idle')
      setIsDragOver(false)
    }
  }, [open])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ACCEPTED_FILE_TYPES.includes(ext)) {
        logger.warn(`Unsupported file type: ${ext}`)
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        logger.warn(`File too large: ${file.name}`)
        return false
      }
      return true
    })
    setFiles((prev) => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)
    setResults([])
    setCurrentStep('uploading')

    try {
      const formData = new FormData()
      formData.append('sourceId', sourceId)
      files.forEach((file) => formData.append('file', file))

      setProgress(50)
      const uploadResponse = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json()
        throw new Error(data.error || 'Upload failed')
      }

      const uploadData = await uploadResponse.json()
      setProgress(100)
      setCurrentStep('complete')

      const uploadResults: UploadResult[] = uploadData.results.map((r: any) => ({
        name: r.name,
        documentId: r.documentId,
        status: r.error ? 'failed' : 'processing',
        error: r.error,
      }))
      setResults(uploadResults)
      onSuccess()

      setTimeout(() => {
        onOpenChange(false)
      }, 1200)
    } catch (error: any) {
      logger.error('Upload failed', error)
      setCurrentStep('error')
      setResults([{ name: 'Upload', error: error.message }])
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      onOpenChange(false)
    }
  }

  const hasResults = results.length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[16px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center">
              <Upload className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white tracking-tight">
                Upload Documents
              </DialogTitle>
              <p className="text-[12px] font-logo text-zinc-500 dark:text-white/70 mt-0.5">
                Add documents to{' '}
                <span className="text-zinc-700 dark:text-white/85 font-medium">{sourceName}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="h-px bg-black/[0.04] dark:bg-white/[0.04] -mx-6" />

          {/* Drop Zone */}
          {!hasResults && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-[#4A7A68]/30 bg-[#4A7A68]/[0.03] dark:border-[#94B8A6]/30 dark:bg-[#94B8A6]/[0.03]'
                  : 'border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-white/[0.01] hover:border-black/[0.1] dark:hover:border-white/[0.1]'
              }`}
            >
              <div className="h-11 w-11 rounded-xl bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.06] flex items-center justify-center mx-auto mb-3">
                <Upload
                  className={`h-5 w-5 transition-colors ${
                    isDragOver
                      ? 'text-[#4A7A68] dark:text-[#94B8A6]'
                      : 'text-zinc-400 dark:text-white/60'
                  }`}
                  strokeWidth={1.5}
                />
              </div>
              <p className="text-[13px] font-logo text-zinc-600 dark:text-white/80 mb-1">
                Drag and drop files here, or{' '}
                <span className="text-[#4A7A68] dark:text-[#94B8A6] font-medium">browse</span>
              </p>
              <p className="text-[11px] font-logo text-zinc-400 dark:text-white/60">
                PDF, TXT, MD, DOC, DOCX, XLS, XLSX, CSV, JSON, HTML (max 100MB)
              </p>
              <input
                id="file-input"
                type="file"
                multiple
                accept={ACCEPTED_FILE_TYPES.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File List */}
          {files.length > 0 && !hasResults && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-black/[0.04] dark:border-white/[0.04] bg-[#fafafa] dark:bg-white/[0.01] group"
                >
                  <FileText
                    className="h-3.5 w-3.5 text-zinc-400 dark:text-white/60 flex-shrink-0"
                    strokeWidth={1.5}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[13px] font-logo text-zinc-700 dark:text-white/85 block truncate"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-logo text-zinc-400 dark:text-white/60 flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="h-5 w-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:text-white/60 dark:hover:text-white/90 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:opacity-0"
                  >
                    <X className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-center gap-2">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-[#4A7A68] dark:text-[#94B8A6]"
                  strokeWidth={1.5}
                />
                <span className="text-[13px] font-logo text-zinc-600 dark:text-white/80">
                  Uploading {files.length} file(s)...
                </span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}

          {/* Results */}
          {hasResults && (
            <div className="space-y-3">
              {/* Success */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#4A7A68]/10 bg-[#4A7A68]/[0.03] dark:border-[#94B8A6]/10 dark:bg-[#94B8A6]/[0.03]">
                <CheckCircle
                  className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6] flex-shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <div className="min-w-0">
                  <span className="text-[13px] font-logo font-medium text-[#4A7A68] dark:text-[#94B8A6] block">
                    {results.filter((r) => !r.error).length} file(s) uploaded successfully
                  </span>
                  <span className="text-[11px] font-logo text-zinc-500 dark:text-white/70">
                    Processing will continue in the background
                  </span>
                </div>
              </div>

              {/* Errors */}
              {results.some((r) => r.error) && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {results
                    .filter((r) => r.error)
                    .map((result, index) => (
                      <div
                        key={index}
                        className="silver-glass-pane smoky-glass-pane flex items-start gap-2.5 rounded-lg border border-rose-500/[0.16] bg-rose-500/[0.05] p-3 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06]"
                      >
                        <div className="smoky-glass-chip mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[9px] border border-rose-500/[0.16] bg-rose-500/[0.08] dark:border-rose-400/[0.14] dark:bg-rose-400/[0.08]">
                          <AlertCircle
                            className="h-3.5 w-3.5 text-rose-500 dark:text-rose-300"
                            strokeWidth={1.5}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span
                            className="block truncate text-[12px] font-logo text-zinc-700 dark:text-white/78"
                            title={result.name}
                          >
                            {result.name}
                          </span>
                          <span
                            className="block truncate text-[11px] font-logo text-rose-600/80 dark:text-rose-200/75"
                            title={result.error}
                          >
                            {result.error}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-px bg-black/[0.04] dark:bg-white/[0.04]" />
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="h-9 px-4 rounded-lg text-[13px] font-logo font-medium text-zinc-500 dark:text-white/60 hover:text-zinc-700 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40"
          >
            {hasResults ? 'Close' : 'Cancel'}
          </button>
          {!hasResults && !uploading && (
            <button
              onClick={handleUpload}
              disabled={files.length === 0}
              className="h-9 px-4 rounded-lg bg-[#4A7A68] hover:bg-[#3d6556] text-white text-[13px] font-logo font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              Upload {files.length > 0 ? `(${files.length})` : ''}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
