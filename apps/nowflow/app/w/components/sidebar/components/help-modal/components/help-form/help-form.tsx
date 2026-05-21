'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { zodResolver } from '@hookform/resolvers/zod'
import imageCompression from 'browser-image-compression'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ModernErrorIcon,
  ModernSuccessIcon,
  ModernUploadIcon,
} from '@/components/modern-logs-icons'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('HelpForm')

// Define form schema
const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['bug', 'feedback', 'feature_request', 'other'] as const),
})

type FormValues = z.infer<typeof formSchema>

// Increased maximum upload size to 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024
// Target size after compression (2MB)
const TARGET_SIZE_MB = 2
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

interface ImageWithPreview extends File {
  preview: string
}

interface HelpFormProps {
  onClose: () => void
}

export function HelpForm({ onClose }: HelpFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [images, setImages] = useState<ImageWithPreview[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      subject: '',
      message: '',
      type: 'bug',
    },
    mode: 'onChange',
  })

  // Set default value for type on component mount
  useEffect(() => {
    setValue('type', 'bug')
  }, [setValue])

  // Scroll to top when success message appears
  useEffect(() => {
    if (submitStatus === 'success' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [submitStatus])

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.preview))
    }
  }, [images])

  const compressImage = async (file: File): Promise<File> => {
    // Skip compression for small files or GIFs (which don't compress well)
    if (file.size < TARGET_SIZE_MB * 1024 * 1024 || file.type === 'image/gif') {
      return file
    }

    const options = {
      maxSizeMB: TARGET_SIZE_MB,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type,
      initialQuality: 0.8,
      alwaysKeepResolution: true,
    }

    try {
      const compressedFile = await imageCompression(file, options)

      return new File([compressedFile], file.name, {
        type: file.type,
        lastModified: new Date().getTime(),
      })
    } catch (error) {
      logger.warn('Image compression failed, using original file:', { error })
      return file
    }
  }

  const processFiles = async (files: FileList | File[]) => {
    setImageError(null)

    if (!files || files.length === 0) return

    setIsProcessing(true)

    try {
      const newImages: ImageWithPreview[] = []
      let hasError = false

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setImageError(`File ${file.name} is too large. Maximum size is 20MB.`)
          hasError = true
          continue
        }

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setImageError(
            `File ${file.name} has an unsupported format. Please use JPEG, PNG, WebP, or GIF.`
          )
          hasError = true
          continue
        }

        const compressedFile = await compressImage(file)

        const imageWithPreview = Object.assign(compressedFile, {
          preview: URL.createObjectURL(compressedFile),
        }) as ImageWithPreview

        newImages.push(imageWithPreview)
      }

      if (!hasError && newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages])
      }
    } catch (error) {
      logger.error('Error processing images:', { error })
      setImageError('An error occurred while processing images. Please try again.')
    } finally {
      setIsProcessing(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files)
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const formData = new FormData()

      formData.append('email', data.email)
      formData.append('subject', data.subject)
      formData.append('message', data.message)
      formData.append('type', data.type)

      images.forEach((image, index) => {
        formData.append(`image_${index}`, image)
      })

      const response = await fetch('/api/help', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit help request')
      }

      setSubmitStatus('success')
      reset()

      images.forEach((image) => URL.revokeObjectURL(image.preview))
      setImages([])
    } catch (error) {
      logger.error('Error submitting help request:', { error })
      setSubmitStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 px-6 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-black/[0.08] dark:scrollbar-thumb-white/[0.08] hover:scrollbar-thumb-black/[0.12] dark:hover:scrollbar-thumb-white/[0.12] scrollbar-track-transparent"
      >
        <div className="py-5">
          {submitStatus === 'success' ? (
            <Alert className="mb-6 rounded-xl border border-[#4A7A68]/[0.15] text-[#4A7A68] dark:border-[#94B8A6]/[0.14] dark:text-[#b8d6c8]">
              <div className="flex items-start gap-3.5 py-1.5">
                <div className="smoky-glass-chip flex-shrink-0 mt-[-1px] rounded-lg border border-[#4A7A68]/[0.15] bg-transparent p-1.5 dark:border-[#94B8A6]/[0.14]">
                  <ModernSuccessIcon className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]" />
                </div>
                <div className="flex-1 space-y-1.5 mr-4">
                  <AlertTitle className="flex items-center justify-between -mt-0.5">
                    <span className="text-[13px] font-logo font-semibold text-[#4A7A68] dark:text-[#94B8A6]">
                      Success
                    </span>
                  </AlertTitle>
                  <AlertDescription className="text-[12px] font-logo text-[#4A7A68]/80 dark:text-[#94B8A6]/80 leading-relaxed">
                    Your request has been submitted successfully. We'll get back to you soon.
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : submitStatus === 'error' ? (
            <Alert className="mb-6 rounded-xl border border-rose-500/[0.16] text-rose-700 dark:border-rose-400/[0.14] dark:text-rose-200">
              <div className="flex items-start gap-3.5 py-1.5">
                <div className="smoky-glass-chip flex-shrink-0 mt-[-1px] rounded-lg border border-rose-500/[0.16] bg-transparent p-1.5 dark:border-rose-400/[0.14]">
                  <ModernErrorIcon className="h-3.5 w-3.5 text-red-600/80 dark:text-red-400/90" />
                </div>
                <div className="flex-1 space-y-1.5 mr-4">
                  <AlertTitle className="flex items-center justify-between -mt-0.5">
                    <span className="text-[13px] font-logo font-semibold text-red-600/80 dark:text-red-400/90">
                      Error
                    </span>
                  </AlertTitle>
                  <AlertDescription className="text-[12px] font-logo text-red-600/70 dark:text-red-400/70 leading-relaxed">
                    {errorMessage ||
                      'There was an error submitting your request. Please try again.'}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ) : null}

          <div className="space-y-5">
            {/* Request Type */}
            <div className="space-y-2">
              <Label
                htmlFor="type"
                className="text-[11px] font-logo font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-white/40"
              >
                Request Type
              </Label>
              <Select defaultValue="bug" onValueChange={(value) => setValue('type', value as any)}>
                <SelectTrigger
                  id="type"
                  className={`h-9 text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] text-black/80 dark:text-white/85 focus:border-[#4A7A68]/30 dark:focus:border-[#94B8A6]/25 focus:ring-[#4A7A68]/10 dark:focus:ring-[#94B8A6]/10 transition-all duration-200 ${errors.type ? 'border-red-500/40' : ''}`}
                >
                  <SelectValue placeholder="Select a request type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="bug" className="text-[13px] font-logo rounded-lg">
                    Bug Report
                  </SelectItem>
                  <SelectItem value="feedback" className="text-[13px] font-logo rounded-lg">
                    Feedback
                  </SelectItem>
                  <SelectItem value="feature_request" className="text-[13px] font-logo rounded-lg">
                    Feature Request
                  </SelectItem>
                  <SelectItem value="other" className="text-[13px] font-logo rounded-lg">
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-[11px] font-logo text-red-500/80 mt-1">{errors.type.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[11px] font-logo font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-white/40"
              >
                Email
              </Label>
              <Input
                id="email"
                placeholder="your.email@example.com"
                {...register('email')}
                className={`h-9 text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] text-black/80 dark:text-white/85 placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-[#4A7A68]/30 dark:focus:border-[#94B8A6]/25 focus:ring-[#4A7A68]/10 dark:focus:ring-[#94B8A6]/10 transition-all duration-200 ${errors.email ? 'border-red-500/40' : ''}`}
              />
              {errors.email && (
                <p className="text-[11px] font-logo text-red-500/80 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label
                htmlFor="subject"
                className="text-[11px] font-logo font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-white/40"
              >
                Subject
              </Label>
              <Input
                id="subject"
                placeholder="Brief description of your request"
                {...register('subject')}
                className={`h-9 text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] text-black/80 dark:text-white/85 placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-[#4A7A68]/30 dark:focus:border-[#94B8A6]/25 focus:ring-[#4A7A68]/10 dark:focus:ring-[#94B8A6]/10 transition-all duration-200 ${errors.subject ? 'border-red-500/40' : ''}`}
              />
              {errors.subject && (
                <p className="text-[11px] font-logo text-red-500/80 mt-1">
                  {errors.subject.message}
                </p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label
                htmlFor="message"
                className="text-[11px] font-logo font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-white/40"
              >
                Message
              </Label>
              <Textarea
                id="message"
                placeholder="Please provide details about your request..."
                rows={5}
                {...register('message')}
                className={`text-[13px] font-logo rounded-lg border-black/[0.08] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] text-black/80 dark:text-white/85 placeholder:text-black/25 dark:placeholder:text-white/25 focus:border-[#4A7A68]/30 dark:focus:border-[#94B8A6]/25 focus:ring-[#4A7A68]/10 dark:focus:ring-[#94B8A6]/10 transition-all duration-200 resize-none ${errors.message ? 'border-red-500/40' : ''}`}
              />
              {errors.message && (
                <p className="text-[11px] font-logo text-red-500/80 mt-1">
                  {errors.message.message}
                </p>
              )}
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2.5 pt-1">
              <Label className="text-[11px] font-logo font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-white/40">
                Attachments
              </Label>
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex items-center gap-3.5 p-3 rounded-xl border border-dashed transition-all duration-200 ${
                  isDragging
                    ? 'border-[#4A7A68]/40 dark:border-[#94B8A6]/30 bg-[#4A7A68]/[0.04] dark:bg-[#94B8A6]/[0.04]'
                    : 'border-black/[0.08] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 h-8 px-3 rounded-lg bg-[#4A7A68]/[0.06] dark:bg-[#94B8A6]/[0.08] hover:bg-[#4A7A68]/[0.10] dark:hover:bg-[#94B8A6]/[0.12] border border-[#4A7A68]/[0.12] dark:border-[#94B8A6]/[0.10] transition-all duration-200"
                >
                  <ModernUploadIcon className="h-3.5 w-3.5 text-[#4A7A68] dark:text-[#94B8A6]" />
                  <span className="text-[12px] font-logo font-medium text-[#4A7A68] dark:text-[#94B8A6]">
                    Upload
                  </span>
                </Button>
                <p className="text-[11px] font-logo text-black/35 dark:text-white/40">
                  Drop images here or click to upload. Max 20MB per image.
                </p>
              </div>
              {imageError && (
                <p className="text-[11px] font-logo text-red-500/80 mt-1">{imageError}</p>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full border-2 border-[#4A7A68]/30 dark:border-[#94B8A6]/30 border-t-[#4A7A68] dark:border-t-[#94B8A6] animate-spin" />
                  <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                    Processing images...
                  </p>
                </div>
              )}
            </div>

            {/* Image Preview Section */}
            {images.length > 0 && (
              <div className="space-y-2.5">
                <Label className="text-[11px] font-logo font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-white/40">
                  Uploaded Images
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className="relative rounded-xl overflow-hidden group border border-black/[0.06] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                    >
                      <div className="aspect-video relative">
                        <Image
                          src={image.preview}
                          alt={`Preview ${index + 1}`}
                          fill
                          sizes="(max-width: 640px) 50vw, 200px"
                          className="object-cover"
                        />
                        <div
                          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center cursor-pointer"
                          onClick={() => removeImage(index)}
                        >
                          <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                            <X className="h-4 w-4 text-white" strokeWidth={1.5} />
                          </div>
                        </div>
                      </div>
                      <div className="px-2.5 py-1.5 text-[11px] font-logo truncate text-black/50 dark:text-white/50 bg-black/[0.02] dark:bg-white/[0.02]">
                        {image.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="px-6 pb-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] mt-auto">
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={onClose}
            type="button"
            className="h-8 px-4 text-[12px] font-logo font-medium rounded-lg text-black/50 dark:text-white/55 hover:text-black/70 dark:hover:text-white/75 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.06] transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isProcessing}
            className="h-8 px-5 text-[12px] font-logo font-semibold rounded-lg bg-[#4A7A68] hover:bg-[#3d6a59] dark:bg-[#94B8A6]/90 dark:hover:bg-[#94B8A6] text-white dark:text-[#1b1b1b] shadow-[0_1px_3px_rgba(74,122,104,0.3)] dark:shadow-[0_1px_3px_rgba(148,184,166,0.2)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Request'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
