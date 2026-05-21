'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ModernAddIcon,
  ModernAlertIcon,
  ModernEnvironmentIcon,
  ModernKeyIcon,
  ModernRemoveIcon,
  ModernValueIcon,
} from '@/components/modern-environment-icons'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEnvironmentStore } from '@/stores/settings/environment/store'
import { EnvironmentVariable as StoreEnvironmentVariable } from '@/stores/settings/environment/types'

// Constants
const GRID_COLS = 'grid grid-cols-[minmax(0,1fr),minmax(0,1fr),40px] gap-4'
const INITIAL_ENV_VAR: UIEnvironmentVariable = { key: '', value: '' }

interface UIEnvironmentVariable extends StoreEnvironmentVariable {
  id?: number
}

interface EnvironmentVariablesProps {
  onOpenChange: (open: boolean) => void
}

export function EnvironmentVariables({ onOpenChange }: EnvironmentVariablesProps) {
  // Store access
  const { variables } = useEnvironmentStore()

  // State
  const [envVars, setEnvVars] = useState<UIEnvironmentVariable[]>([])
  const [focusedValueIndex, setFocusedValueIndex] = useState<number | null>(null)
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false)

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pendingClose = useRef(false)
  const initialVarsRef = useRef<UIEnvironmentVariable[]>([])

  // Derived state
  const hasChanges = useMemo(() => {
    const initialVars = initialVarsRef.current.filter((v) => v.key || v.value)
    const currentVars = envVars.filter((v) => v.key || v.value)

    const initialMap = new Map(initialVars.map((v) => [v.key, v.value]))
    const currentMap = new Map(currentVars.map((v) => [v.key, v.value]))

    if (initialMap.size !== currentMap.size) return true

    for (const [key, value] of currentMap) {
      const initialValue = initialMap.get(key)
      if (initialValue !== value) return true
    }

    for (const key of initialMap.keys()) {
      if (!currentMap.has(key)) return true
    }

    return false
  }, [envVars])

  // Initialization effect
  useEffect(() => {
    const existingVars = Object.values(variables)
    const initialVars = existingVars.length ? existingVars : [INITIAL_ENV_VAR]
    initialVarsRef.current = JSON.parse(JSON.stringify(initialVars))
    setEnvVars(JSON.parse(JSON.stringify(initialVars)))
    pendingClose.current = false
  }, [variables])

  // Scroll effect
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [envVars.length])

  // Variable management functions
  const addEnvVar = () => {
    const newVar = { key: '', value: '', id: Date.now() }
    setEnvVars([...envVars, newVar])
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars]
    newEnvVars[index][field] = value
    setEnvVars(newEnvVars)
  }

  const removeEnvVar = (index: number) => {
    const newEnvVars = envVars.filter((_, i) => i !== index)
    setEnvVars(newEnvVars.length ? newEnvVars : [INITIAL_ENV_VAR])
  }

  // Input event handlers
  const handleValueFocus = (index: number, e: React.FocusEvent<HTMLInputElement>) => {
    setFocusedValueIndex(index)
    e.target.scrollLeft = 0
  }

  const handleValueClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.currentTarget.scrollLeft = 0
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = e.clipboardData.getData('text').trim()
    if (!text) return

    const lines = text.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return

    e.preventDefault()

    const inputType = (e.target as HTMLInputElement).getAttribute('data-input-type') as
      | 'key'
      | 'value'
    const containsKeyValuePair = text.includes('=')

    if (inputType && !containsKeyValuePair) {
      handleSingleValuePaste(text, index, inputType)
      return
    }

    handleKeyValuePaste(lines)
  }

  const handleSingleValuePaste = (text: string, index: number, inputType: 'key' | 'value') => {
    const newEnvVars = [...envVars]
    newEnvVars[index][inputType] = text
    setEnvVars(newEnvVars)
  }

  const handleKeyValuePaste = (lines: string[]) => {
    const parsedVars = lines
      .map((line) => {
        const [key, ...valueParts] = line.split('=')
        const value = valueParts.join('=').trim()
        return {
          key: key.trim(),
          value,
          id: Date.now() + Math.random(),
        }
      })
      .filter(({ key, value }) => key && value)

    if (parsedVars.length > 0) {
      const existingVars = envVars.filter((v) => v.key || v.value)
      setEnvVars([...existingVars, ...parsedVars])
    }
  }

  // Dialog management
  const handleClose = () => {
    if (hasChanges) {
      setShowUnsavedChanges(true)
      pendingClose.current = true
    } else {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    setEnvVars(JSON.parse(JSON.stringify(initialVarsRef.current)))
    setShowUnsavedChanges(false)
    if (pendingClose.current) {
      onOpenChange(false)
    }
  }

  const handleSave = () => {
    try {
      // Close modal immediately for optimistic updates
      setShowUnsavedChanges(false)
      onOpenChange(false)

      // Convert valid env vars to Record<string, string>
      const validVariables = envVars
        .filter((v) => v.key && v.value)
        .reduce(
          (acc, { key, value }) => ({
            ...acc,
            [key]: value,
          }),
          {}
        )

      // Single store update that triggers sync
      useEnvironmentStore.getState().setVariables(validVariables)
    } catch (error) {
      console.error('Failed to save environment variables:', error)
    }
  }

  // UI rendering
  const renderEnvVarRow = (envVar: UIEnvironmentVariable, index: number) => (
    <div
      key={envVar.id || index}
      className={`${GRID_COLS} silver-glass-pane items-center rounded-lg border border-black/[0.06] bg-transparent p-1 transition-all duration-200 hover:bg-black/[0.025] dark:border-white/[0.08] dark:hover:bg-white/[0.04]`}
    >
      <Input
        data-input-type="key"
        value={envVar.key}
        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
        onPaste={(e) => handlePaste(e, index)}
        placeholder="API_KEY"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        className="silver-glass-pane border-black/[0.06] bg-transparent transition-all duration-200 hover:bg-black/[0.025] focus-visible:border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/30 dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
        name={`env-var-key-${envVar.id || index}-${Math.random()}`}
      />
      <Input
        data-input-type="value"
        value={envVar.value}
        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
        type={focusedValueIndex === index ? 'text' : 'password'}
        onFocus={(e) => handleValueFocus(index, e)}
        onClick={handleValueClick}
        onBlur={() => setFocusedValueIndex(null)}
        onPaste={(e) => handlePaste(e, index)}
        placeholder="Enter value"
        className="allow-scroll silver-glass-pane border-black/[0.06] bg-transparent transition-all duration-200 hover:bg-black/[0.025] focus-visible:border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/30 dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        name={`env-var-value-${envVar.id || index}-${Math.random()}`}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removeEnvVar(index)}
        className="silver-glass-chip h-8 w-8 rounded-full border-black/[0.06] transition-all duration-200 hover:bg-red-50 hover:text-red-500 dark:border-white/[0.08] dark:hover:bg-red-500/10"
      >
        <ModernRemoveIcon className="h-5 w-5" />
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="px-6 pt-6">
        <h2 className="text-[15px] font-logo font-semibold mb-4 text-zinc-800 dark:text-white flex items-center gap-2">
          <span className="bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10] p-1.5 rounded-lg">
            <ModernEnvironmentIcon className="h-5 w-5 text-[#4A7A68] dark:text-[#94B8A6]" />
          </span>
          Environment Variables
        </h2>
        <p className="text-[12px] font-logo text-black/50 dark:text-white/60 mb-6 ml-9">
          Store sensitive information that will be available to your workflows.
        </p>
        <div className={`${GRID_COLS} px-0.5 mb-2`}>
          <Label className="flex items-center gap-1.5 text-[#4A7A68] dark:text-[#94B8A6]">
            <ModernKeyIcon className="h-4 w-4" />
            Key
          </Label>
          <Label className="flex items-center gap-1.5 text-[#4A7A68] dark:text-[#94B8A6]">
            <ModernValueIcon className="h-4 w-4" />
            Value
          </Label>
          <div />
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 px-6 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/30 scrollbar-track-transparent"
      >
        <div className="space-y-3 py-2">{envVars.map(renderEnvVarRow)}</div>
      </div>

      {/* Fixed Footer */}
      <div className="silver-glass-pane mt-auto border-t border-black/[0.06] bg-transparent px-6 pb-6 pt-4 dark:border-white/[0.08]">
        <div className="flex flex-col gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={addEnvVar}
            className="silver-glass-button border-[#4A7A68]/18 bg-[#4A7A68]/[0.08] text-[#4A7A68] shadow-sm transition-all duration-200 hover:bg-black/[0.04] hover:text-[#4A7A68] dark:border-[#94B8A6]/18 dark:bg-[#94B8A6]/[0.10] dark:text-[#94B8A6] dark:hover:bg-white/[0.06] dark:hover:text-[#94B8A6] flex items-center justify-center gap-1.5"
          >
            <ModernAddIcon className="h-4 w-4" />
            Add Variable
          </Button>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="silver-glass-button border-black/[0.06] transition-all duration-200 hover:bg-black/[0.04] dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="bg-primary/90 hover:bg-primary transition-all duration-200 shadow-sm"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showUnsavedChanges} onOpenChange={setShowUnsavedChanges}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <ModernAlertIcon className="h-6 w-6 text-[#4A7A68] dark:text-[#94B8A6]" />
              <AlertDialogTitle className="text-zinc-800 dark:text-white">
                Unsaved Changes
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-[12px] font-logo text-black/50 dark:text-white/60">
              You have unsaved changes. Do you want to save them before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancel}
              className="silver-glass-button border-black/[0.06] transition-all duration-200 hover:bg-black/[0.04] dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
            >
              Discard Changes
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSave}
              className="silver-glass-button-strong rounded-[10px] border border-black/[0.06] px-4 transition-all duration-200 dark:border-white/[0.08]"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
