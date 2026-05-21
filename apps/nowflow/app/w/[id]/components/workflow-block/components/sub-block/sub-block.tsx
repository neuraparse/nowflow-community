import React, { memo, useCallback, useMemo } from 'react'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useValidationStore } from '@/stores/validation/store'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'
import { getBlock } from '@/blocks/index'
import {
  isAdvancedInputType,
  isBasicInputType,
  isIntegrationInputType,
  SubBlockConfig,
} from '@/blocks/types'
import { AgentProfileSelector } from './components/agent-profile-selector'
import { CheckboxList } from './components/checkbox-list'
import { Code } from './components/code'
import { ConditionInput } from './components/condition-input'
import { CredentialSelector } from './components/credential-selector/credential-selector'
import { DateInput } from './components/date-input'
import { Dropdown } from './components/dropdown'
import { EvalInput } from './components/eval-input'
import { FileSelectorInput } from './components/file-selector/file-selector-input'
import { FileUpload } from './components/file-upload'
import { FolderSelectorInput } from './components/folder-selector/components/folder-selector-input'
import { KnowledgeSourceInput } from './components/knowledge-source-input'
import { LongInput } from './components/long-input'
import { ProjectSelectorInput } from './components/project-selector/project-selector-input'
import { ScheduleConfig } from './components/schedule/schedule-config'
import { ShortInput } from './components/short-input'
import { SliderInput } from './components/slider-input'
import { InputFormat } from './components/starter/input-format'
import { Switch } from './components/switch'
import { Table } from './components/table'
import { ChannelsSelector } from './components/teams-selector/channels-selector'
import { ChatsSelector } from './components/teams-selector/chats-selector'
import { TeamsSelector } from './components/teams-selector/teams-selector'
import { TimeInput } from './components/time-input'
import { ToolInput } from './components/tool-input/tool-input'
import { WebhookConfig } from './components/webhook/webhook-config'

interface SubBlockProps {
  blockId: string
  config: SubBlockConfig
  isConnecting: boolean
}

const SubBlock = memo<SubBlockProps>(({ blockId, config, isConnecting }) => {
  // CRITICAL: Use stable function references instead of subscribing to the entire store.
  // The old `useSubBlockStore()` (no selector) caused this component to re-render on
  // EVERY subblock store change — including SSE updates every 1-2 seconds. This created
  // excessive re-renders that could interfere with validation store subscriptions.
  const getValue = useSubBlockStore((s) => s.getValue)
  const setValue = useSubBlockStore((s) => s.setValue)

  // Subscribe to this field's value — only re-renders when THIS value changes
  const activeWorkflowId = useWorkflowRegistry((s) => s.activeWorkflowId)
  const value = useSubBlockStore(
    useCallback(
      (s) =>
        activeWorkflowId
          ? (s.workflowValues[activeWorkflowId]?.[blockId]?.[config.id] ?? null)
          : null,
      [activeWorkflowId, blockId, config.id]
    )
  )

  // Subscribe to condition field values for visibility — only re-renders when
  // the condition dependency field changes, not on every subblock store change.
  const conditionFieldValue = useSubBlockStore(
    useCallback(
      (s) => {
        if (!config.condition || !activeWorkflowId) return undefined
        return s.workflowValues[activeWorkflowId]?.[blockId]?.[config.condition.field] ?? null
      },
      [activeWorkflowId, blockId, config.condition?.field]
    )
  )
  const andConditionFieldValue = useSubBlockStore(
    useCallback(
      (s) => {
        if (!config.condition?.and || !activeWorkflowId) return undefined
        return s.workflowValues[activeWorkflowId]?.[blockId]?.[config.condition.and.field] ?? null
      },
      [activeWorkflowId, blockId, config.condition?.and?.field]
    )
  )

  // Validation state for this field.
  // CRITICAL FIX: Use primitive-returning selectors (counts) instead of creating
  // new arrays with .filter() on every render. The old selectors returned new array
  // references every time, causing Zustand to detect false "changes" via Object.is
  // and triggering excessive re-renders. With counts (primitives), Object.is(0, 0)
  // is true → no unnecessary re-render. The actual error/warning objects are read
  // from the store during render only when needed.
  const fieldErrorCount = useValidationStore(
    useCallback(
      (s) => {
        const result = s.blockValidations[blockId]
        if (!result) return 0
        return result.errors.filter((e) => e.field === config.id).length
      },
      [blockId, config.id]
    )
  )
  const fieldWarningCount = useValidationStore(
    useCallback(
      (s) => {
        const result = s.blockValidations[blockId]
        if (!result) return 0
        return result.warnings.filter((e) => e.field === config.id).length
      },
      [blockId, config.id]
    )
  )
  // Read actual error/warning objects from store only when count > 0
  const fieldErrors =
    fieldErrorCount > 0
      ? (useValidationStore
          .getState()
          .blockValidations[blockId]?.errors.filter((e) => e.field === config.id) ?? null)
      : null
  const fieldWarnings =
    fieldWarningCount > 0
      ? (useValidationStore
          .getState()
          .blockValidations[blockId]?.warnings.filter((e) => e.field === config.id) ?? null)
      : null

  const isHighlighted = useValidationStore(
    useCallback(
      (s) => s.highlightedField?.blockId === blockId && s.highlightedField?.fieldId === config.id,
      [blockId, config.id]
    )
  )

  // Handle value change
  const handleChange = useCallback(
    (newValue: any) => {
      setValue(blockId, config.id, newValue)

      // Live clearing: remove validation errors for THIS FIELD only (not entire block)
      const validationStore = useValidationStore.getState()
      if (validationStore.blockValidations[blockId]) {
        validationStore.clearFieldError(blockId, config.id)
      }
    },
    [setValue, blockId, config.id]
  )

  // Memoized field requirement check
  const isFieldRequired = useMemo(() => {
    const blockType = useWorkflowStore.getState().blocks[blockId]?.type
    if (!blockType) return false

    const blockConfig = getBlock(blockType)
    if (!blockConfig) return false

    return blockConfig.inputs[config.id]?.required === true
  }, [blockId, config.id])

  // Compute visibility from the dedicated condition field subscriptions above.
  // Each condition field has its own Zustand selector, so visibility updates
  // reactively when the condition dependency changes — without subscribing to
  // the entire subblock store.
  let isVisible = true
  if (config.condition) {
    const expectedValue = config.condition.value
    // Treat null/undefined as empty string for condition matching
    const normalizedFieldValue = conditionFieldValue ?? ''
    const isMatch = Array.isArray(expectedValue)
      ? expectedValue.includes(normalizedFieldValue)
      : normalizedFieldValue === expectedValue
    const primaryResult = config.condition.not ? !isMatch : isMatch

    let andResult = true
    if (config.condition.and) {
      const andExpected = config.condition.and.value
      const normalizedAndValue = andConditionFieldValue ?? ''
      const andIsMatch = Array.isArray(andExpected)
        ? andExpected.includes(normalizedAndValue)
        : normalizedAndValue === andExpected
      andResult = config.condition.and.not ? !andIsMatch : andIsMatch
    }

    isVisible = primaryResult && andResult
  }

  // Common props for all input components
  const commonProps = useMemo(
    () => ({
      blockId,
      subBlockId: config.id,
      isConnecting,
      config,
    }),
    [blockId, config.id, isConnecting, config]
  )

  // Early return if not visible
  if (!isVisible) return null

  // Self-contained sub-block types: they manage their own visibility and title.
  // When no data exists (no profiles / no knowledge sources), they return null entirely.
  if (config.type === 'agent-profile-selector') {
    return (
      <AgentProfileSelector
        blockId={blockId}
        subBlockId={config.id}
        value={value || ''}
        onChange={handleChange}
      />
    )
  }
  if (config.type === 'knowledge-source-input') {
    return <KnowledgeSourceInput blockId={blockId} subBlockId={config.id} />
  }

  // Input renderer
  const renderInput = () => {
    // Basic input types
    if (isBasicInputType(config.type)) {
      switch (config.type) {
        case 'short-input':
          return (
            <ShortInput
              {...commonProps}
              placeholder={config.placeholder}
              password={config.password}
            />
          )
        case 'long-input':
          return <LongInput {...commonProps} placeholder={config.placeholder} rows={config.rows} />
        case 'dropdown':
          return <Dropdown {...commonProps} options={config.options as string[]} />
        case 'slider':
          return (
            <SliderInput
              {...commonProps}
              min={config.min}
              max={config.max}
              defaultValue={(config.min || 0) + ((config.max || 100) - (config.min || 0)) / 2}
              step={config.step}
              integer={config.integer}
            />
          )
        case 'switch':
          return <Switch {...commonProps} title={config.title ?? ''} />
        case 'checkbox':
          return <Switch {...commonProps} title={config.title ?? ''} />
        case 'date-input':
          return <DateInput {...commonProps} placeholder={config.placeholder} />
        case 'time-input':
          return <TimeInput {...commonProps} placeholder={config.placeholder} />
        default:
          return null
      }
    }

    // Advanced input types
    if (isAdvancedInputType(config.type)) {
      switch (config.type) {
        case 'table':
          return <Table {...commonProps} columns={config.columns ?? []} />
        case 'code':
          return (
            <Code
              {...commonProps}
              placeholder={config.placeholder}
              language={config.language as 'javascript' | 'json' | 'text' | 'graphql'}
              generationType={config.generationType as 'javascript-function-body' | 'json-schema'}
            />
          )
        case 'checkbox-list':
          return (
            <CheckboxList
              {...commonProps}
              title={config.title ?? ''}
              options={config.options as { label: string; id: string }[]}
              layout={config.layout}
            />
          )
        case 'condition-input':
          return <ConditionInput {...commonProps} />
        case 'eval-input':
          return <EvalInput {...commonProps} />
        case 'tool-input':
          return <ToolInput {...commonProps} />
        case 'webhook-config':
          return <WebhookConfig {...commonProps} />
        case 'schedule-config':
          return <ScheduleConfig {...commonProps} />
        case 'input-format':
          return <InputFormat {...commonProps} />
        default:
          return null
      }
    }

    // Integration input types
    if (isIntegrationInputType(config.type)) {
      switch (config.type) {
        case 'oauth-input':
          return (
            <CredentialSelector
              value={value || ''}
              onChange={handleChange}
              provider={config.provider as any}
              serviceId={config.serviceId}
              requiredScopes={config.requiredScopes || []}
              label={config.title || 'Select credential'}
            />
          )
        case 'file-upload':
          return (
            <FileUpload
              {...commonProps}
              acceptedTypes={config.acceptedTypes || '*'}
              multiple={config.multiple === true}
              maxSize={config.maxSize}
            />
          )
        case 'file-selector':
          return <FileSelectorInput {...commonProps} subBlock={config} disabled={isConnecting} />
        case 'project-selector':
          return <ProjectSelectorInput {...commonProps} subBlock={config} disabled={isConnecting} />
        case 'folder-selector':
          return <FolderSelectorInput {...commonProps} subBlock={config} disabled={isConnecting} />
        case 'teams-selector':
          return (
            <TeamsSelector
              value={value || ''}
              onChange={handleChange}
              provider={config.provider || 'microsoft'}
              requiredScopes={config.requiredScopes || []}
              serviceId={config.serviceId}
              label={config.placeholder || 'Select team'}
              disabled={isConnecting}
            />
          )
        case 'channels-selector':
          return (
            <ChannelsSelector
              value={value || ''}
              onChange={handleChange}
              blockId={blockId}
              teamIdSubBlockId={config.dependsOn || 'teamId'}
              credentialSubBlockId={config.credentialSubBlockId || 'credential'}
              label={config.placeholder || 'Select channel'}
              disabled={isConnecting}
            />
          )
        case 'chats-selector':
          return (
            <ChatsSelector
              value={value || ''}
              onChange={handleChange}
              blockId={blockId}
              credentialSubBlockId={config.credentialSubBlockId || 'credential'}
              label={config.placeholder || 'Select chat or enter email'}
              disabled={isConnecting}
              allowEmailInput={config.allowEmailInput !== false}
            />
          )
        default:
          return <div>Unknown input type: {config.type}</div>
      }
    }

    return <div>Unknown input type: {config.type}</div>
  }

  const required = isFieldRequired

  return (
    <div
      data-subblock-id={config.id}
      className={cn(
        'space-y-2 pt-1 relative group/subblock transform-gpu',
        isHighlighted && 'animate-[highlight-field_2s_ease-out_forwards]'
      )}
    >
      {config.type !== 'switch' && (
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-[12px] font-logo font-medium text-white/90">
            {config.title}
            {required && <span className="text-red-500">*</span>}
            {config.description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-white/40 cursor-help" strokeWidth={1.5} />
                </TooltipTrigger>
                <TooltipContent className="bg-[#1b1b1b] text-white text-[11px] font-logo border-none">
                  <p>{config.description}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </Label>
          <div className="text-[10px] font-logo text-white/50 px-1.5 py-0.5 rounded-lg bg-white/10 border border-white/20">
            {String(config.type)
              .split('-')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </div>
        </div>
      )}
      <div className={cn('relative', fieldErrors?.length && 'rounded-md ring-1 ring-amber-500/50')}>
        <div className="absolute -inset-1 bg-gradient-to-r from-black/[0.02] to-black/[0.04] dark:from-white/[0.02] dark:to-white/[0.04] rounded-lg opacity-0 group-hover/subblock:opacity-100 -z-10 transition-all duration-300 ease-out" />
        {renderInput()}
      </div>

      {/* Validation error message */}
      {fieldErrors && fieldErrors.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] font-logo text-amber-600 dark:text-amber-400 mt-1 px-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <span>{fieldErrors[0].message}</span>
            {fieldErrors[0].suggestion && (
              <span className="text-black/35 dark:text-white/45 ml-1">
                ({fieldErrors[0].suggestion})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Validation warning message */}
      {!fieldErrors?.length && fieldWarnings && fieldWarnings.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] font-logo text-amber-600 dark:text-amber-400 mt-1 px-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{fieldWarnings[0].message}</span>
        </div>
      )}
    </div>
  )
})

SubBlock.displayName = 'SubBlock'

export { SubBlock }
