import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createLogger } from '@/lib/logs/console-logger'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { TRIGGER_OUTPUT_FIELDS } from '@/blocks/blocks/starter'

const logger = createLogger('QuickAddConnectionPopover')

interface QuickAddConnectionPopoverProps {
  incomingConnections: any[]
  onAddConnection: (connection: any, field?: any) => void
}

// Extract fields from a response format schema
function extractFieldsFromSchema(responseFormat: any): any[] {
  if (!responseFormat || typeof responseFormat !== 'object') {
    return []
  }

  // Skip invalid formats like {"e": {}}
  if (responseFormat.e && Object.keys(responseFormat).length === 1) {
    return []
  }

  // Handle legacy format with fields array
  if (Array.isArray(responseFormat.fields)) {
    return responseFormat.fields
  }

  // Handle new JSON Schema format
  const schema = responseFormat.schema || responseFormat
  if (!schema || !schema.properties || typeof schema.properties !== 'object') {
    return []
  }

  // Extract fields from schema properties
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || 'string',
    description: prop.description,
  }))
}

// Extract fields from starter block based on trigger type or input format
function extractFieldsFromStarterInput(connection: any): any[] {
  if (connection.type !== 'starter') return []

  try {
    const startWorkflowValue = useSubBlockStore.getState().getValue(connection.id, 'startWorkflow')

    if (startWorkflowValue && startWorkflowValue !== 'manual') {
      const triggerFields = TRIGGER_OUTPUT_FIELDS[startWorkflowValue as string]
      if (triggerFields) {
        return [...triggerFields]
      }
    }

    const inputFormatValue = useSubBlockStore.getState().getValue(connection.id, 'inputFormat')

    if (!inputFormatValue) return []

    const inputFormat =
      typeof inputFormatValue === 'string' ? JSON.parse(inputFormatValue) : inputFormatValue

    if (!Array.isArray(inputFormat)) return []

    const fields = inputFormat
      .filter((field: any) => field.name && field.name.trim() !== '')
      .map((field: any) => ({
        name: field.name,
        type: field.type || 'string',
        description: field.description,
      }))

    return [{ name: 'input', type: 'object', description: 'Complete input data' }, ...fields]
  } catch (e) {
    logger.error('Error extracting fields from starter input format:', e)
    return [{ name: 'input', type: 'any' }]
  }
}

function getConnectionFields(connection: any): any[] {
  if (connection.availableFields && connection.availableFields.length > 0) {
    logger.debug('Quick Add Connection - Using execution fields:', {
      connectionId: connection.id,
      connectionName: connection.name,
      fields: connection.availableFields,
      fieldCount: connection.availableFields.length,
    })
    return connection.availableFields
  }

  logger.debug('Quick Add Connection - No execution fields, using schema fallback:', {
    connectionId: connection.id,
    connectionName: connection.name,
    hasAvailableFields: !!connection.availableFields,
    availableFieldsLength: connection.availableFields?.length || 0,
    hasExecutionResult: !!connection.executionResult,
    executionResultKeys: connection.executionResult ? Object.keys(connection.executionResult) : [],
  })

  let fields: any[] = []

  if (connection.type === 'starter') {
    fields = extractFieldsFromStarterInput(connection)
  } else {
    fields = extractFieldsFromSchema(connection.responseFormat)
  }

  if (fields.length === 0 && Array.isArray(connection.outputType)) {
    fields = connection.outputType.map((fieldName: string) => ({
      name: fieldName,
      type: 'string',
    }))
  }

  logger.debug('Quick Add Connection - Using schema fields:', fields)
  return fields
}

const normalizeBlockName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')

export function QuickAddConnectionPopover({
  incomingConnections,
  onAddConnection,
}: QuickAddConnectionPopoverProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  const handleAdd = (connection: any, field?: any) => {
    onAddConnection(connection, field)
    setShowQuickAdd(false)
  }

  return (
    <Popover open={showQuickAdd} onOpenChange={setShowQuickAdd}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-primary/10">
              <svg
                className="w-3 h-3 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Insert block output</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-96 p-0 z-[99999]"
        align="end"
        side="bottom"
        style={{ zIndex: 99999 }}
      >
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <h4 className="text-sm font-semibold">Connect Data Sources</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Select data from connected blocks to use in this field
          </p>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {incomingConnections.map((connection) => {
            const fields = getConnectionFields(connection)

            return (
              <div key={connection.id} className="p-3 border-b border-border/50 last:border-b-0">
                {/* Connection header with execution status */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      connection.executionResult
                        ? 'bg-green-500/20 border-green-500/60'
                        : 'bg-primary/20 border-primary/40'
                    }`}
                  ></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-foreground">
                        {connection.name || `Block ${connection.id}`}
                      </div>
                      {connection.executionResult && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                          executed
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {connection.type || 'Unknown Type'}
                      {connection.availableFields && connection.availableFields.length > 0 && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          • {connection.availableFields.length} live fields
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main output */}
                <button
                  className="w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 mb-2 border border-border/30 hover:border-border/60"
                  onClick={() => handleAdd(connection)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">Complete Output</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Full response from {connection.name || connection.id}
                      </div>
                    </div>
                    <span className="text-xs font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border">
                      &lt;
                      {connection.name ? normalizeBlockName(connection.name) : connection.id}
                      .response&gt;
                    </span>
                  </div>
                </button>

                {/* Response format fields */}
                {fields.map((field) => {
                  const blockRef = connection.name
                    ? normalizeBlockName(connection.name)
                    : connection.id
                  const displayTag =
                    field.name === 'response'
                      ? `<${blockRef}.response>`
                      : `<${blockRef}.response.${field.name}>`

                  return (
                    <button
                      key={field.name}
                      className="w-full text-left p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 mb-2 border border-border/30 hover:border-border/60"
                      onClick={() => handleAdd(connection, field)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
                        <div className="flex-1">
                          <span className="text-sm font-medium capitalize">{field.name}</span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {field.type} field from {connection.name || connection.id}
                          </div>
                        </div>
                        <span className="text-xs font-mono bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border">
                          {displayTag}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
