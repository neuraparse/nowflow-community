'use client'

import { useCallback, useEffect, useState } from 'react'
import { Code, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { ModernCustomToolsIcon } from '@/components/modern-settings-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { createLogger } from '@/lib/logs/console-logger'
import { useCustomToolsStore } from '@/stores/custom-tools/store'

const logger = createLogger('CustomTools')

export function CustomTools() {
  const tools = useCustomToolsStore((s) => s.getAllTools())
  const isLoading = useCustomToolsStore((s) => s.isLoading)
  const loadCustomTools = useCustomToolsStore((s) => s.loadCustomTools)
  const addTool = useCustomToolsStore((s) => s.addTool)
  const updateTool = useCustomToolsStore((s) => s.updateTool)
  const removeTool = useCustomToolsStore((s) => s.removeTool)
  const sync = useCustomToolsStore((s) => s.sync)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<string | null>(null)
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formFunctionName, setFormFunctionName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formParameters, setFormParameters] = useState(
    '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}'
  )
  const [formCode, setFormCode] = useState('')

  useEffect(() => {
    loadCustomTools()
  }, [loadCustomTools])

  const resetForm = useCallback(() => {
    setFormTitle('')
    setFormFunctionName('')
    setFormDescription('')
    setFormParameters('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}')
    setFormCode('')
    setEditingTool(null)
  }, [])

  const handleCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (toolId: string) => {
    const tool = tools.find((t) => t.id === toolId)
    if (!tool) return
    setFormTitle(tool.title)
    setFormFunctionName(tool.schema.function.name)
    setFormDescription(tool.schema.function.description || '')
    setFormParameters(JSON.stringify(tool.schema.function.parameters, null, 2))
    setFormCode(tool.code)
    setEditingTool(toolId)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formFunctionName.trim() || !formCode.trim()) return

    let parameters
    try {
      parameters = JSON.parse(formParameters)
    } catch {
      logger.error('Invalid JSON parameters')
      return
    }

    setIsSaving(true)
    try {
      const toolData = {
        title: formTitle.trim(),
        schema: {
          type: 'function' as const,
          function: {
            name: formFunctionName.trim(),
            description: formDescription.trim() || undefined,
            parameters,
          },
        },
        code: formCode,
      }

      if (editingTool) {
        updateTool(editingTool, toolData)
      } else {
        addTool(toolData)
      }

      await sync()
      setDialogOpen(false)
      resetForm()
    } catch (error) {
      logger.error('Failed to save tool:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingToolId) return
    try {
      removeTool(deletingToolId)
      await sync()
    } catch (error) {
      logger.error('Failed to delete tool:', error)
    } finally {
      setDeleteDialogOpen(false)
      setDeletingToolId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
            <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
              <ModernCustomToolsIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
            </span>
            Custom Tools
            {tools.length > 0 && (
              <span className="text-xs font-normal bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] text-[#4A7A68] dark:text-[#94B8A6] px-2 py-0.5 rounded-full">
                {tools.length}
              </span>
            )}
          </h2>
          <Button size="sm" onClick={handleCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Create Tool
          </Button>
        </div>
        <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-6 ml-9">
          Create and manage custom tools that can be used in your workflow blocks.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <ToolCardSkeleton />
          <ToolCardSkeleton />
          <ToolCardSkeleton />
        </div>
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center mb-4">
            <Wrench className="h-8 w-8 text-zinc-400 dark:text-white/40" strokeWidth={1.5} />
          </div>
          <h4 className="text-lg font-medium mb-2">No custom tools yet</h4>
          <p className="text-[12px] font-logo text-zinc-400 dark:text-white/40 mb-4 max-w-sm">
            Custom tools extend your workflows with reusable functions. Create your first tool to
            get started.
          </p>
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Create your first tool
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="silver-glass-pane flex items-start justify-between py-3 px-4 rounded-lg bg-transparent transition-all duration-200"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-2 rounded-lg mt-0.5 shrink-0">
                  <Code className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <p className="font-logo text-[12px] text-zinc-800 dark:text-white font-medium">
                    {tool.title}
                  </p>
                  <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 font-mono mt-0.5">
                    {tool.schema.function.name}()
                  </p>
                  {tool.schema.function.description && (
                    <p className="text-[11px] font-logo text-zinc-400 dark:text-white/40 mt-1 line-clamp-1">
                      {tool.schema.function.description}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-400 dark:text-white/40 mt-1.5">
                    Created{' '}
                    {new Date(tool.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleEdit(tool.id)}
                >
                  <Pencil
                    className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40"
                    strokeWidth={1.5}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:text-red-500"
                  onClick={() => {
                    setDeletingToolId(tool.id)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm()
          setDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[550px] rounded-[16px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-800 dark:text-white">
              {editingTool ? 'Edit Tool' : 'Create Custom Tool'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Tool Name</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="My Custom Tool"
              />
            </div>
            <div className="space-y-2">
              <Label>Function Name</Label>
              <Input
                value={formFunctionName}
                onChange={(e) => setFormFunctionName(e.target.value)}
                placeholder="my_custom_function"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What does this tool do?"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-zinc-400 dark:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Parameters (JSON Schema)</Label>
              <textarea
                value={formParameters}
                onChange={(e) => setFormParameters(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <textarea
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="// Your tool implementation..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[120px] resize-y"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                setDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !formTitle.trim() || !formFunctionName.trim() || !formCode.trim() || isSaving
              }
            >
              {isSaving ? 'Saving...' : editingTool ? 'Update Tool' : 'Create Tool'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-rose-500/18">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 dark:text-rose-300">
              Delete Custom Tool
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this tool. Workflows using this tool may stop working
              correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="border border-rose-500/18 bg-rose-600/90 text-white hover:bg-rose-700/95 dark:border-rose-400/18 dark:bg-rose-500/85"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const ToolCardSkeleton = () => (
  <div className="silver-glass-pane flex items-start justify-between py-3 px-4 rounded-lg bg-transparent">
    <div className="flex items-start gap-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div>
        <Skeleton className="h-4 w-32 mb-1.5" />
        <Skeleton className="h-3 w-24 mb-1" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
    <div className="flex gap-1">
      <Skeleton className="h-7 w-7 rounded-lg" />
      <Skeleton className="h-7 w-7 rounded-lg" />
    </div>
  </div>
)
