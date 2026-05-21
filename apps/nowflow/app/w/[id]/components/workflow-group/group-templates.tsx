'use client'

import { useState } from 'react'
import { Download, FolderOpen, Save, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { GroupState } from '@/stores/workflows/workflow/types'

interface GroupTemplate {
  id: string
  name: string
  description?: string
  nodeTypes: string[]
  createdAt: number
}

interface GroupTemplatesProps {
  selectedNodeIds: string[]
}

export function GroupTemplates({ selectedNodeIds }: GroupTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [savedTemplates, setSavedTemplates] = useState<GroupTemplate[]>([])

  // Read blocks at call time, subscribe only to action functions
  const createGroup = useWorkflowStore((s) => s.createGroup)
  const clearSelection = useWorkflowStore((s) => s.clearSelection)
  const getBlocks = () => useWorkflowStore.getState().blocks

  // Save current selection as template
  const handleSaveTemplate = () => {
    if (!templateName.trim() || selectedNodeIds.length < 2) return

    const blocks = getBlocks()
    const selectedBlocks = selectedNodeIds.map((id) => blocks[id]).filter(Boolean)
    const nodeTypes = [...new Set(selectedBlocks.map((block) => block.type))]

    const template: GroupTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      nodeTypes,
      createdAt: Date.now(),
    }

    // Save to localStorage
    const existingTemplates = JSON.parse(localStorage.getItem('workflow-group-templates') || '[]')
    const updatedTemplates = [...existingTemplates, template]
    localStorage.setItem('workflow-group-templates', JSON.stringify(updatedTemplates))
    setSavedTemplates(updatedTemplates)

    // Reset form
    setTemplateName('')
    setTemplateDescription('')
    setIsOpen(false)
  }

  // Load templates from localStorage
  const loadTemplates = () => {
    const templates = JSON.parse(localStorage.getItem('workflow-group-templates') || '[]')
    setSavedTemplates(templates)
  }

  // Apply template (create group with template name)
  const handleApplyTemplate = (template: GroupTemplate) => {
    if (selectedNodeIds.length >= 2) {
      createGroup(selectedNodeIds, template.name)
      clearSelection()
      setIsOpen(false)
    }
  }

  // Export templates
  const handleExportTemplates = () => {
    const templates = JSON.parse(localStorage.getItem('workflow-group-templates') || '[]')
    const dataStr = JSON.stringify(templates, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'workflow-group-templates.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Import templates
  const handleImportTemplates = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedTemplates = JSON.parse(e.target?.result as string)
        if (Array.isArray(importedTemplates)) {
          const existingTemplates = JSON.parse(
            localStorage.getItem('workflow-group-templates') || '[]'
          )
          const mergedTemplates = [...existingTemplates, ...importedTemplates]
          localStorage.setItem('workflow-group-templates', JSON.stringify(mergedTemplates))
          setSavedTemplates(mergedTemplates)
        }
      } catch (error) {
        console.error('Failed to import templates:', error)
      }
    }
    reader.readAsText(file)
  }

  if (selectedNodeIds.length < 2) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            loadTemplates()
            setIsOpen(true)
          }}
          className="h-8"
        >
          <Save className="w-3 h-3 mr-1" />
          Templates
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Group Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Save new template */}
          <Card className="p-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Save Current Selection</h4>
              <Input
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                maxLength={30}
              />
              <Input
                placeholder="Description (optional)"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                maxLength={100}
              />
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="w-full"
              >
                <Save className="w-3 h-3 mr-1" />
                Save Template
              </Button>
            </div>
          </Card>

          {/* Saved templates */}
          {savedTemplates.length > 0 && (
            <Card className="p-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Saved Templates</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {template.nodeTypes.join(', ')}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApplyTemplate(template)}
                        className="h-8 w-8 p-0"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Import/Export */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportTemplates} className="flex-1">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
            <label className="flex-1">
              <Button size="sm" variant="outline" className="w-full" asChild>
                <span>
                  <Upload className="w-3 h-3 mr-1" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImportTemplates}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
