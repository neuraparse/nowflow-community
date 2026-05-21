'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Calendar, CheckCircle2, FileText, Loader2, Star, Upload } from 'lucide-react'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('PublicFormPage')

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface FormField {
  id: string
  type: string
  label: string
  placeholder: string
  required: boolean
  options: Array<{ label: string; value: string }>
  validation: Record<string, unknown>
}

interface FormSettings {
  submitButtonText: string
  successMessage: string
  redirectUrl: string
  theme: 'light' | 'dark'
  branding: boolean
}

interface PublicFormData {
  id: string
  name: string
  description: string | null
  slug: string
  status: string
  fields: FormField[]
  settings: FormSettings
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function PublicFormPage() {
  const params = useParams()
  const formId = params.id as string

  const [formData, setFormData] = useState<PublicFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  // ------------------------------------------------------------------
  // Load form
  // ------------------------------------------------------------------

  useEffect(() => {
    const abortController = new AbortController()

    if (formId) {
      loadForm(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [formId])

  const loadForm = async (signal?: AbortSignal) => {
    try {
      setLoading(true)

      const formResponse = await fetch(`/api/interfaces/${formId}/submit`, { signal })
      if (formResponse.ok) {
        const data = await formResponse.json()
        if (signal?.aborted) return
        const f = data.form
        setFormData({
          ...f,
          fields: Array.isArray(f.fields) ? f.fields : [],
          settings: {
            submitButtonText: 'Submit',
            successMessage: 'Thank you for your submission!',
            redirectUrl: '',
            theme: 'light',
            branding: true,
            ...(typeof f.settings === 'object' ? f.settings : {}),
          },
        })
      } else if (formResponse.status === 400) {
        setError('This form is not currently accepting responses.')
      } else {
        setError('Form not found or is no longer available.')
      }
    } catch (err) {
      if (isAbortLikeError(err, signal)) {
        return
      }

      logger.error('Failed to load form', err)
      setError('Something went wrong. Please try again later.')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  // ------------------------------------------------------------------
  // Field value management
  // ------------------------------------------------------------------

  const updateFieldValue = (fieldId: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
    // Clear error on change
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------

  const validate = (): boolean => {
    if (!formData) return false
    const errors: Record<string, string> = {}

    for (const field of formData.fields) {
      if (field.required) {
        const value = fieldValues[field.id]
        if (value === undefined || value === null || value === '') {
          errors[field.id] = `${field.label} is required`
        }
      }

      // Email validation
      if (field.type === 'email' && fieldValues[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(fieldValues[field.id]))) {
          errors[field.id] = 'Please enter a valid email address'
        }
      }

      // URL validation
      if (field.type === 'url' && fieldValues[field.id]) {
        try {
          new URL(String(fieldValues[field.id]))
        } catch {
          errors[field.id] = 'Please enter a valid URL'
        }
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData || !validate()) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/interfaces/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: fieldValues }),
      })

      const result = await response.json()

      if (response.ok) {
        setSuccessMessage(result.message || formData.settings.successMessage)
        setSubmitted(true)

        if (result.redirectUrl) {
          setTimeout(() => {
            window.location.href = result.redirectUrl
          }, 1500)
        }
      } else {
        setError(result.error || 'Failed to submit form. Please try again.')
      }
    } catch (err) {
      logger.error('Form submission error', err)
      setError('Something went wrong. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  // ------------------------------------------------------------------
  // Theme helpers
  // ------------------------------------------------------------------

  const isDark = formData?.settings.theme === 'dark'
  const bgClass = isDark ? 'bg-slate-950' : 'bg-[#fafafa]'
  const cardBgClass = isDark ? 'bg-slate-900 border-white/[0.06]' : 'bg-white border-black/[0.06]'
  const textClass = isDark ? 'text-white' : 'text-zinc-800'
  const textMutedClass = isDark ? 'text-white/40' : 'text-zinc-400'
  const inputBgClass =
    'silver-glass-pane smoky-glass-pane glass-field border-0 bg-transparent text-zinc-800 placeholder:text-zinc-400 focus:ring-0 dark:text-white dark:placeholder:text-white/40'

  // ------------------------------------------------------------------
  // Render field
  // ------------------------------------------------------------------

  const renderField = (field: FormField) => {
    const hasError = !!fieldErrors[field.id]
    const errorBorderClass = hasError ? 'border border-red-500' : ''

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={String(fieldValues[field.id] || '')}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`w-full rounded-md px-3 py-2 text-sm outline-none transition-colors duration-200 ${inputBgClass} ${errorBorderClass}`}
          />
        )

      case 'select':
        return (
          <select
            value={String(fieldValues[field.id] || '')}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            className={`glass-native-select w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors duration-200 ${inputBgClass} ${errorBorderClass}`}
          >
            <option value="">Select an option...</option>
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!fieldValues[field.id]}
              onChange={(e) => updateFieldValue(field.id, e.target.checked)}
              className="h-4 w-4 rounded border-black/[0.06] dark:border-white/[0.06] text-violet-600 focus:ring-violet-500"
            />
            <span
              className={`text-sm ${isDark ? 'text-white/60' : 'text-zinc-800 dark:text-white'}`}
            >
              {field.label}
            </span>
          </label>
        )

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={opt.value}
                  checked={fieldValues[field.id] === opt.value}
                  onChange={() => updateFieldValue(field.id, opt.value)}
                  className="h-4 w-4 border-black/[0.06] dark:border-white/[0.06] text-violet-600 focus:ring-violet-500"
                />
                <span
                  className={`text-sm ${isDark ? 'text-white/60' : 'text-zinc-800 dark:text-white'}`}
                >
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
        )

      case 'file_upload':
        return (
          <label
            className={`flex flex-col items-center justify-center w-full h-28 rounded-md border-2 border-dashed cursor-pointer transition-colors duration-200 ${
              isDark
                ? 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.03]'
                : 'border-black/[0.06] hover:border-black/[0.12] bg-[#fafafa]'
            } ${errorBorderClass}`}
          >
            <Upload className={`h-6 w-6 mb-1 ${textMutedClass}`} />
            <span className={`text-sm ${textMutedClass}`}>
              {fieldValues[field.id] ? 'File selected' : 'Click to upload'}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  updateFieldValue(field.id, file.name)
                }
              }}
            />
          </label>
        )

      case 'date':
        return (
          <div className="relative">
            <input
              type="date"
              value={String(fieldValues[field.id] || '')}
              onChange={(e) => updateFieldValue(field.id, e.target.value)}
              className={`w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors duration-200 ${inputBgClass} ${errorBorderClass}`}
            />
          </div>
        )

      case 'slider':
        return (
          <div className="pt-2 pb-1">
            <input
              type="range"
              min={0}
              max={100}
              value={Number(fieldValues[field.id] || 50)}
              onChange={(e) => updateFieldValue(field.id, Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-xs mt-1">
              <span className={textMutedClass}>0</span>
              <span className={`font-medium ${textClass}`}>
                {fieldValues[field.id] !== undefined ? String(fieldValues[field.id]) : '50'}
              </span>
              <span className={textMutedClass}>100</span>
            </div>
          </div>
        )

      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => updateFieldValue(field.id, i)}
                className="focus:outline-none"
              >
                <Star
                  className={`h-7 w-7 transition-colors duration-200 ${
                    i <= (Number(fieldValues[field.id]) || 0)
                      ? 'text-amber-400 fill-amber-400'
                      : isDark
                        ? 'text-white/25'
                        : 'text-zinc-400 dark:text-white/25'
                  }`}
                />
              </button>
            ))}
          </div>
        )

      default:
        return (
          <input
            type={
              field.type === 'email'
                ? 'email'
                : field.type === 'number'
                  ? 'number'
                  : field.type === 'url'
                    ? 'url'
                    : field.type === 'phone'
                      ? 'tel'
                      : 'text'
            }
            value={String(fieldValues[field.id] || '')}
            onChange={(e) => updateFieldValue(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors duration-200 focus:ring-2 ${inputBgClass} ${errorBorderClass}`}
          />
        )
    }
  }

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-slate-950 font-logo">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 dark:text-white/40">Loading form...</p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Error state (form not found / not published)
  // ------------------------------------------------------------------

  if (error && !formData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-slate-950 px-4 font-logo">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-light tracking-tight font-logo text-zinc-800 dark:text-white mb-2">
            Form Unavailable
          </h1>
          <p className="text-zinc-400 dark:text-white/40">{error}</p>
        </div>
      </div>
    )
  }

  if (!formData) return null

  // ------------------------------------------------------------------
  // Success state
  // ------------------------------------------------------------------

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 font-logo ${bgClass}`}>
        <div
          className={`rounded-xl border shadow-sm p-8 max-w-md w-full text-center ${cardBgClass}`}
        >
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className={`text-xl font-light tracking-tight font-logo mb-2 ${textClass}`}>
            Submitted
          </h2>
          <p className={textMutedClass}>{successMessage}</p>
          {formData.settings.branding && (
            <p className={`text-xs mt-6 ${isDark ? 'text-white/25' : 'text-zinc-400'}`}>
              Powered by NowFlow
            </p>
          )}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Form render
  // ------------------------------------------------------------------

  return (
    <div
      className={`min-h-screen flex items-start justify-center py-8 sm:py-16 px-4 font-logo ${bgClass}`}
    >
      <div className={`rounded-xl border shadow-sm w-full max-w-lg ${cardBgClass}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`h-10 w-10 rounded-md flex items-center justify-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-100'}`}
            >
              <FileText className={`h-5 w-5 ${isDark ? 'text-violet-300' : 'text-violet-600'}`} />
            </div>
            <h1 className={`text-xl font-light tracking-tight font-logo ${textClass}`}>
              {formData.name}
            </h1>
          </div>
          {formData.description && (
            <p className={`text-sm ${textMutedClass}`}>{formData.description}</p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="space-y-5">
            {formData.fields.map((field) => (
              <div key={field.id}>
                {field.type !== 'checkbox' && (
                  <label
                    className={`block text-sm font-medium font-logo mb-1.5 ${isDark ? 'text-white' : 'text-zinc-800'}`}
                  >
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                )}
                {renderField(field)}
                {fieldErrors[field.id] && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-zinc-800 dark:bg-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-zinc-900 py-2.5 text-[13px] font-semibold font-logo tracking-[0.02em] transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting...' : formData.settings.submitButtonText}
          </button>

          {/* Branding */}
          {formData.settings.branding && (
            <p className={`text-center text-xs mt-4 ${isDark ? 'text-white/25' : 'text-zinc-400'}`}>
              Powered by NowFlow
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
