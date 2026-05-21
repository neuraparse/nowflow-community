'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlignLeft,
  ArrowLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  GripVertical,
  Hash,
  Link,
  ListChecks,
  Mail,
  Phone,
  Plus,
  Save,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
  Type,
  Upload,
  Workflow,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/lib/auth-client'
import { isAbortLikeError } from '@/lib/errors/network'
import { createLogger } from '@/lib/logs/console-logger'
import { useSidebarStore } from '@/stores/sidebar/store'

const logger = createLogger('FormBuilderPage')

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

interface FormData {
  id: string
  name: string
  description: string | null
  slug: string
  status: string
  fields: FormField[]
  settings: FormSettings
  workflowId: string | null
  dataTableId: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

// ------------------------------------------------------------------
// Field type definitions
// ------------------------------------------------------------------

const FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'textarea', label: 'Text Area', icon: AlignLeft },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'url', label: 'URL', icon: Link },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'select', label: 'Dropdown', icon: ListChecks },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'radio', label: 'Radio Group', icon: Circle },
  { type: 'file_upload', label: 'File Upload', icon: Upload },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'slider', label: 'Slider', icon: SlidersHorizontal },
  { type: 'rating', label: 'Rating', icon: Star },
] as const

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function FormBuilderPage() {
  const router = useRouter()
  const params = useParams()
  const formId = params.id as string
  const { data: session, isPending } = useSession()
  const { mode, isExpanded } = useSidebarStore()
  const isSidebarCollapsed =
    mode === 'expanded' ? !isExpanded : mode === 'collapsed' || mode === 'hover'

  const [formData, setFormData] = useState<FormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'settings'>('fields')
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null)

  // Workflow / table lists for connection dropdowns
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([])
  const [dataTables, setDataTables] = useState<Array<{ id: string; name: string }>>([])

  // ------------------------------------------------------------------
  // Load form data
  // ------------------------------------------------------------------

  useEffect(() => {
    const abortController = new AbortController()

    if (!isPending && session?.user && formId) {
      loadForm(abortController.signal)
      loadWorkflows(abortController.signal)
      loadDataTables(abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [session, isPending, formId])

  const loadForm = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/interfaces/${formId}`, { signal })
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setFormData({
          ...data.form,
          fields: Array.isArray(data.form.fields) ? data.form.fields : [],
          settings: {
            submitButtonText: 'Submit',
            successMessage: 'Thank you for your submission!',
            redirectUrl: '',
            theme: 'light',
            branding: true,
            ...(typeof data.form.settings === 'object' ? data.form.settings : {}),
          },
        })
      } else {
        router.push('/w/interfaces')
      }
    } catch (error) {
      if (isAbortLikeError(error, signal)) {
        return
      }

      logger.error('Failed to load form', error)
      router.push('/w/interfaces')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  const loadWorkflows = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/workflows', { signal })
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setWorkflows(
          (data.workflows || []).map((w: { id: string; name: string }) => ({
            id: w.id,
            name: w.name,
          }))
        )
      }
    } catch {
      // Non-critical
    }
  }

  const loadDataTables = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/tables', { signal })
      if (response.ok) {
        const data = await response.json()
        if (signal?.aborted) return
        setDataTables(
          (data.tables || []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          }))
        )
      }
    } catch {
      // Non-critical
    }
  }

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!formData) return
    setSaving(true)
    try {
      const response = await fetch(`/api/interfaces/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          fields: formData.fields,
          settings: formData.settings,
          workflowId: formData.workflowId,
          dataTableId: formData.dataTableId,
          status: formData.status,
          isPublic: formData.isPublic,
        }),
      })
      if (!response.ok) {
        logger.error('Failed to save form')
      }
    } catch (error) {
      logger.error('Failed to save form', error)
    } finally {
      setSaving(false)
    }
  }, [formData, formId])

  // ------------------------------------------------------------------
  // Field operations
  // ------------------------------------------------------------------

  const addField = (type: string) => {
    if (!formData) return
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: FIELD_TYPES.find((ft) => ft.type === type)?.label || 'Field',
      placeholder: '',
      required: false,
      options:
        type === 'select' || type === 'radio'
          ? [
              { label: 'Option 1', value: 'option_1' },
              { label: 'Option 2', value: 'option_2' },
            ]
          : [],
      validation: {},
    }
    setFormData((prev) => (prev ? { ...prev, fields: [...prev.fields, newField] } : prev))
    setSelectedFieldId(newField.id)
  }

  const removeField = (fieldId: string) => {
    if (!formData) return
    setFormData((prev) =>
      prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== fieldId) } : prev
    )
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null)
    }
  }

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    if (!formData) return
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
          }
        : prev
    )
  }

  const moveField = (fromIndex: number, toIndex: number) => {
    if (!formData) return
    const newFields = [...formData.fields]
    const [moved] = newFields.splice(fromIndex, 1)
    newFields.splice(toIndex, 0, moved)
    setFormData((prev) => (prev ? { ...prev, fields: newFields } : prev))
  }

  // ------------------------------------------------------------------
  // Drag handlers
  // ------------------------------------------------------------------

  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedFieldIndex !== null && draggedFieldIndex !== index) {
      moveField(draggedFieldIndex, index)
      setDraggedFieldIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedFieldIndex(null)
  }

  // ------------------------------------------------------------------
  // Publish toggle
  // ------------------------------------------------------------------

  const togglePublish = async () => {
    if (!formData) return
    const newStatus = formData.status === 'published' ? 'draft' : 'published'
    setFormData((prev) =>
      prev ? { ...prev, status: newStatus, isPublic: newStatus === 'published' } : prev
    )
    try {
      await fetch(`/api/interfaces/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, isPublic: newStatus === 'published' }),
      })
    } catch (error) {
      logger.error('Failed to toggle publish', error)
    }
  }

  // ------------------------------------------------------------------
  // Selected field for editing
  // ------------------------------------------------------------------

  const selectedField = formData?.fields.find((f) => f.id === selectedFieldId) || null

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'textarea':
        return (
          <div className="interface-preview-control interface-preview-textarea w-full h-20 rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-white/[0.03] px-3 py-2 text-[13px] font-logo text-zinc-400 dark:text-white/40">
            {field.placeholder || 'Enter text...'}
          </div>
        )
      case 'select':
        return (
          <div className="interface-preview-control w-full h-10 rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-white/[0.03] px-3 py-2 text-[13px] font-logo text-zinc-400 dark:text-white/40 flex items-center justify-between">
            <span>Select an option...</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        )
      case 'checkbox':
        return (
          <div className="interface-preview-choice flex items-center gap-2">
            <div className="interface-preview-choice-box h-4 w-4 rounded border border-black/[0.08] dark:border-white/[0.06]" />
            <span className="interface-preview-choice-label text-[13px] font-logo text-zinc-600 dark:text-white/80">
              {field.label}
            </span>
          </div>
        )
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="interface-preview-choice-box h-4 w-4 rounded-full border border-black/[0.08] dark:border-white/[0.06]" />
                <span className="interface-preview-choice-label text-[13px] font-logo text-zinc-600 dark:text-white/80">
                  {opt.label}
                </span>
              </div>
            ))}
          </div>
        )
      case 'file_upload':
        return (
          <div className="interface-preview-upload w-full h-24 rounded-md border-2 border-dashed border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-white/[0.03] flex items-center justify-center">
            <div className="interface-preview-upload-text text-center text-[13px] font-logo text-zinc-400 dark:text-white/40">
              <Upload className="h-6 w-6 mx-auto mb-1" />
              Click or drag to upload
            </div>
          </div>
        )
      case 'date':
        return (
          <div className="interface-preview-control w-full h-10 rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-white/[0.03] px-3 py-2 text-[13px] font-logo text-zinc-400 dark:text-white/40 flex items-center justify-between">
            <span>Select a date...</span>
            <Calendar className="h-4 w-4" />
          </div>
        )
      case 'slider':
        return (
          <div className="w-full px-1 py-2">
            <div className="relative h-2 rounded-full bg-zinc-200 dark:bg-white/[0.06]">
              <div className="absolute left-0 top-0 h-2 w-1/2 rounded-full bg-[#4A7A68]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white border-2 border-[#4A7A68] shadow" />
            </div>
          </div>
        )
      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-6 w-6 ${
                  i <= 3 ? 'text-amber-400 fill-amber-400' : 'text-zinc-300 dark:text-white/25'
                }`}
              />
            ))}
          </div>
        )
      default:
        return (
          <div className="interface-preview-control w-full h-10 rounded-md border border-black/[0.06] dark:border-white/[0.06] bg-[#fafafa] dark:bg-white/[0.03] px-3 py-2 text-[13px] font-logo text-zinc-400 dark:text-white/40">
            {field.placeholder || 'Enter value...'}
          </div>
        )
    }
  }

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (isPending || loading) {
    return (
      <div
        className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-200 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
            <div className="col-span-6">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
            <div className="col-span-3">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div
        className={`workspace-stage min-h-screen py-8 px-6 transition-all duration-200 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-[13px] font-logo text-zinc-500 dark:text-white/60">Form not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/w/interfaces')}>
            Back to Interfaces
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`workspace-stage workflow-interface-builder min-h-screen py-6 px-4 transition-all duration-200 ${
        isSidebarCollapsed ? 'pl-20' : 'pl-72'
      }`}
    >
      <div className="max-w-[1600px] mx-auto">
        {/* Top bar */}
        <div className="interface-builder-topbar rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900 px-4 py-3 mb-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/w/interfaces')}
                className="flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                className="text-lg font-logo font-semibold border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 max-w-xs text-zinc-800 dark:text-white"
              />
              {formData.status === 'published' ? (
                <Badge className="bg-[#4A7A68]/[0.08] text-[#4A7A68] dark:bg-[#94B8A6]/[0.08] dark:text-[#94B8A6] border-0">
                  Published
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-0">
                  Draft
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {formData.status === 'published' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/forms/${formData.id}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </Button>
              )}
              {formData.status === 'published' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/forms/${formData.id}`)
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Link
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={togglePublish}>
                <Globe className="h-4 w-4 mr-1" />
                {formData.status === 'published' ? 'Unpublish' : 'Publish'}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#4A7A68] hover:bg-[#3d6556] text-white"
              >
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        {/* Main layout: 3 columns */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left panel - Field types / Settings */}
          <div className="col-span-3">
            <Card className="interface-builder-panel bg-white dark:bg-slate-900 sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === 'fields' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('fields')}
                    className={
                      activeTab === 'fields'
                        ? 'interface-builder-tab bg-[#4A7A68] hover:bg-[#3d6556] text-white'
                        : 'interface-builder-tab'
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Fields
                  </Button>
                  <Button
                    variant={activeTab === 'settings' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('settings')}
                    className={
                      activeTab === 'settings'
                        ? 'interface-builder-tab bg-[#4A7A68] hover:bg-[#3d6556] text-white'
                        : 'interface-builder-tab'
                    }
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Settings
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[calc(100dvh-220px)] overflow-y-auto">
                {activeTab === 'fields' ? (
                  <div className="space-y-1">
                    {FIELD_TYPES.map((ft) => {
                      const Icon = ft.icon
                      return (
                        <button
                          key={ft.type}
                          onClick={() => addField(ft.type)}
                          className="interface-field-type-button w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-logo text-zinc-700 dark:text-white/80 hover:bg-[#4A7A68]/[0.04] dark:hover:bg-[#94B8A6]/[0.04] hover:text-[#4A7A68] dark:hover:text-[#94B8A6] transition-colors duration-200 text-left"
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {ft.label}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Form Name */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Form Name
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                        className="mt-1.5"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Description
                      </Label>
                      <Textarea
                        value={formData.description || ''}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev ? { ...prev, description: e.target.value } : prev
                          )
                        }
                        placeholder="Describe what this form is for..."
                        className="mt-1.5"
                        rows={3}
                      />
                    </div>

                    <Separator />

                    {/* Submit Button Text */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Submit Button Text
                      </Label>
                      <Input
                        value={formData.settings.submitButtonText}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  settings: { ...prev.settings, submitButtonText: e.target.value },
                                }
                              : prev
                          )
                        }
                        className="mt-1.5"
                      />
                    </div>

                    {/* Success Message */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Success Message
                      </Label>
                      <Textarea
                        value={formData.settings.successMessage}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  settings: { ...prev.settings, successMessage: e.target.value },
                                }
                              : prev
                          )
                        }
                        className="mt-1.5"
                        rows={2}
                      />
                    </div>

                    {/* Redirect URL */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Redirect URL (optional)
                      </Label>
                      <Input
                        value={formData.settings.redirectUrl}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  settings: { ...prev.settings, redirectUrl: e.target.value },
                                }
                              : prev
                          )
                        }
                        placeholder="https://..."
                        className="mt-1.5"
                      />
                    </div>

                    <Separator />

                    {/* Theme */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Theme
                      </Label>
                      <Select
                        value={formData.settings.theme}
                        onValueChange={(value: 'light' | 'dark') =>
                          setFormData((prev) =>
                            prev ? { ...prev, settings: { ...prev.settings, theme: value } } : prev
                          )
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Branding */}
                    <div className="flex items-center justify-between">
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Show Branding
                      </Label>
                      <Switch
                        checked={formData.settings.branding}
                        onCheckedChange={(checked) =>
                          setFormData((prev) =>
                            prev
                              ? { ...prev, settings: { ...prev.settings, branding: checked } }
                              : prev
                          )
                        }
                      />
                    </div>

                    <Separator />

                    {/* Connect to Workflow */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80 flex items-center gap-1.5">
                        <Workflow className="h-3.5 w-3.5" />
                        Connect to Workflow
                      </Label>
                      <Select
                        value={formData.workflowId || '_none'}
                        onValueChange={(value) =>
                          setFormData((prev) =>
                            prev ? { ...prev, workflowId: value === '_none' ? null : value } : prev
                          )
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {workflows.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Connect to Data Table */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80 flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5" />
                        Connect to Data Table
                      </Label>
                      <Select
                        value={formData.dataTableId || '_none'}
                        onValueChange={(value) =>
                          setFormData((prev) =>
                            prev ? { ...prev, dataTableId: value === '_none' ? null : value } : prev
                          )
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {dataTables.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center - Live preview */}
          <div className="col-span-6">
            <Card className="interface-builder-panel bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
                    <Eye className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
                    Preview
                  </CardTitle>
                  <span className="text-[11px] font-logo text-zinc-400 dark:text-white/40">
                    {formData.fields.length} field{formData.fields.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  data-preview-theme={formData.settings.theme}
                  className={`interface-preview-surface rounded-lg border p-6 min-h-[400px] ${
                    formData.settings.theme === 'dark'
                      ? 'bg-slate-950 border-white/[0.06]'
                      : 'bg-white border-black/[0.06]'
                  }`}
                >
                  {/* Form title */}
                  <h2
                    className={`interface-preview-title text-xl font-logo font-light tracking-tight mb-1 ${
                      formData.settings.theme === 'dark' ? 'text-white' : 'text-zinc-800'
                    }`}
                  >
                    {formData.name}
                  </h2>
                  {formData.description && (
                    <p
                      className={`interface-preview-description text-[13px] font-logo mb-6 ${
                        formData.settings.theme === 'dark' ? 'text-white/60' : 'text-zinc-500'
                      }`}
                    >
                      {formData.description}
                    </p>
                  )}

                  {/* Fields */}
                  {formData.fields.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-zinc-300 dark:text-white/25 mb-3" />
                      <p className="text-zinc-400 dark:text-white/40 text-[13px] font-logo">
                        Add fields from the panel on the left to start building your form.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {formData.fields.map((field, index) => (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedFieldId(field.id)}
                          className={`interface-preview-field group relative rounded-lg border p-4 cursor-pointer transition-all ${
                            selectedFieldId === field.id
                              ? 'border-[#4A7A68]/50 dark:border-[#94B8A6]/50 ring-1 ring-[#4A7A68]/20 dark:ring-[#94B8A6]/20'
                              : formData.settings.theme === 'dark'
                                ? 'border-white/[0.06] hover:border-white/[0.1]'
                                : 'border-black/[0.06] hover:border-black/[0.08]'
                          } ${draggedFieldIndex === index ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="pt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                              <GripVertical className="h-4 w-4 text-zinc-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <label
                                  className={`interface-preview-label text-[13px] font-logo font-medium ${
                                    formData.settings.theme === 'dark'
                                      ? 'text-white/90'
                                      : 'text-zinc-800'
                                  }`}
                                >
                                  {field.label}
                                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                              </div>
                              {renderFieldPreview(field)}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeField(field.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submit button */}
                  {formData.fields.length > 0 && (
                    <div className="mt-6">
                      <div className="interface-preview-submit w-full py-2.5 rounded-xl bg-[#4A7A68] text-white text-center text-[13px] font-logo font-semibold tracking-[0.02em]">
                        {formData.settings.submitButtonText}
                      </div>
                    </div>
                  )}

                  {/* Branding */}
                  {formData.settings.branding && formData.fields.length > 0 && (
                    <p
                      className={`text-center text-[11px] font-logo mt-4 ${
                        formData.settings.theme === 'dark' ? 'text-white/40' : 'text-zinc-400'
                      }`}
                    >
                      Powered by NowFlow
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right panel - Field settings */}
          <div className="col-span-3">
            <Card className="interface-builder-panel bg-white dark:bg-slate-900 sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-[14px] font-logo font-semibold text-zinc-800 dark:text-white">
                  {selectedField ? 'Field Settings' : 'Field Properties'}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[calc(100dvh-220px)] overflow-y-auto">
                {selectedField ? (
                  <div className="space-y-5">
                    {/* Label */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Label
                      </Label>
                      <Input
                        value={selectedField.label}
                        onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Type
                      </Label>
                      <Select
                        value={selectedField.type}
                        onValueChange={(value) => updateField(selectedField.id, { type: value })}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((ft) => (
                            <SelectItem key={ft.type} value={ft.type}>
                              {ft.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Placeholder */}
                    {!['checkbox', 'radio', 'file_upload', 'slider', 'rating'].includes(
                      selectedField.type
                    ) && (
                      <div>
                        <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                          Placeholder
                        </Label>
                        <Input
                          value={selectedField.placeholder}
                          onChange={(e) =>
                            updateField(selectedField.id, { placeholder: e.target.value })
                          }
                          className="mt-1.5"
                        />
                      </div>
                    )}

                    {/* Required */}
                    <div className="flex items-center justify-between">
                      <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80">
                        Required
                      </Label>
                      <Switch
                        checked={selectedField.required}
                        onCheckedChange={(checked) =>
                          updateField(selectedField.id, { required: checked })
                        }
                      />
                    </div>

                    {/* Options (for select & radio) */}
                    {(selectedField.type === 'select' || selectedField.type === 'radio') && (
                      <div>
                        <Label className="text-[12px] font-logo font-medium text-zinc-700 dark:text-white/80 mb-2 block">
                          Options
                        </Label>
                        <div className="space-y-2">
                          {selectedField.options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={opt.label}
                                onChange={(e) => {
                                  const newOptions = [...selectedField.options]
                                  newOptions[i] = {
                                    label: e.target.value,
                                    value: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                                  }
                                  updateField(selectedField.id, { options: newOptions })
                                }}
                                className="flex-1"
                                placeholder={`Option ${i + 1}`}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={() => {
                                  const newOptions = selectedField.options.filter(
                                    (_, idx) => idx !== i
                                  )
                                  updateField(selectedField.id, { options: newOptions })
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newOptions = [
                                ...selectedField.options,
                                {
                                  label: `Option ${selectedField.options.length + 1}`,
                                  value: `option_${selectedField.options.length + 1}`,
                                },
                              ]
                              updateField(selectedField.id, { options: newOptions })
                            }}
                            className="w-full"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Option
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Move up/down */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={formData.fields.findIndex((f) => f.id === selectedField.id) === 0}
                        onClick={() => {
                          const idx = formData.fields.findIndex((f) => f.id === selectedField.id)
                          if (idx > 0) moveField(idx, idx - 1)
                        }}
                      >
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Move Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={
                          formData.fields.findIndex((f) => f.id === selectedField.id) ===
                          formData.fields.length - 1
                        }
                        onClick={() => {
                          const idx = formData.fields.findIndex((f) => f.id === selectedField.id)
                          if (idx < formData.fields.length - 1) moveField(idx, idx + 1)
                        }}
                      >
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Move Down
                      </Button>
                    </div>

                    {/* Delete field */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => removeField(selectedField.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Field
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Settings className="h-8 w-8 mx-auto text-zinc-300 dark:text-white/25 mb-2" />
                    <p className="text-[13px] font-logo text-zinc-400 dark:text-white/40">
                      Select a field in the preview to edit its properties.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
