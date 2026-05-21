import { useState } from 'react'
import { Check, ChevronDown, Copy, Link } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { useBlockConnections } from '@/app/w/[id]/hooks/use-block-connections'
import { getBlock } from '@/blocks'
import { TRIGGER_OUTPUT_FIELDS } from '@/blocks/blocks/starter'

interface ConnectionPanelProps {
  blockId: string
}

export function ConnectionPanel({ blockId }: ConnectionPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copiedTag, setCopiedTag] = useState<string | null>(null)
  const { incomingConnections, hasIncomingConnections } = useBlockConnections(blockId)

  if (!hasIncomingConnections) return null

  const handleCopyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag)
      setCopiedTag(tag)
      setTimeout(() => setCopiedTag(null), 2000)
    } catch (error) {
      console.error('Failed to copy tag:', error)
    }
  }

  return (
    <div className="mb-4 border border-border/40 rounded-lg bg-muted/20 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-3 h-auto hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Connected Data Sources</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {incomingConnections.length}
              </span>
            </div>
            <ChevronDown
              className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t border-border/40">
          <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
            {incomingConnections.map((connection) => {
              // Extract fields using the same logic as connection-blocks component
              const extractFieldsFromSchema = (responseFormat: any): any[] => {
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
              const extractFieldsFromStarterInput = (connection: any): any[] => {
                // Only process for starter blocks
                if (connection.type !== 'starter') return []

                try {
                  // Check if starter is configured as a trigger (email, webhook, form, etc.)
                  const startWorkflowValue = useSubBlockStore
                    .getState()
                    .getValue(connection.id, 'startWorkflow')

                  if (startWorkflowValue && startWorkflowValue !== 'manual') {
                    const triggerFields = TRIGGER_OUTPUT_FIELDS[startWorkflowValue as string]
                    if (triggerFields) {
                      return [...triggerFields]
                    }
                  }

                  // Manual trigger: use input format
                  const inputFormatValue = useSubBlockStore
                    .getState()
                    .getValue(connection.id, 'inputFormat')

                  if (!inputFormatValue) return []

                  const inputFormat =
                    typeof inputFormatValue === 'string'
                      ? JSON.parse(inputFormatValue)
                      : inputFormatValue

                  if (!Array.isArray(inputFormat)) return []

                  // Map input fields to response fields
                  // Note: Executor spreads input fields directly at response level (...inputData)
                  // So fields are accessible as fieldName, not input.fieldName
                  const fields = inputFormat
                    .filter((field: any) => field.name && field.name.trim() !== '')
                    .map((field: any) => ({
                      name: field.name, // Direct field name, not input.fieldName
                      type: field.type || 'string',
                      description: field.description,
                    }))

                  // Also add the complete input object
                  return [
                    { name: 'input', type: 'object', description: 'Complete input data' },
                    ...fields,
                  ]
                } catch (e) {
                  console.error('Error extracting fields from starter input format:', e)
                  return [{ name: 'input', type: 'any' }]
                }
              }

              // Get fields from response format or starter input
              let fields: any[] = []

              if (connection.type === 'starter') {
                fields = extractFieldsFromStarterInput(connection)
              } else {
                fields = extractFieldsFromSchema(connection.responseFormat)
              }

              // If no fields from response format, use outputType array
              if (fields.length === 0 && Array.isArray(connection.outputType)) {
                fields = connection.outputType.map((fieldName: string) => ({
                  name: fieldName,
                  type: 'string',
                }))
              }

              // Get block config for styling
              const blockConfig = getBlock(connection.type)
              const blockColor = blockConfig?.bgColor || '#2F55FF'

              return (
                <div key={connection.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <div
                      className="w-3 h-3 rounded-sm flex items-center justify-center"
                      style={{ backgroundColor: blockColor }}
                    >
                      {blockConfig?.icon ? (
                        <blockConfig.icon className="w-2 h-2 text-white" />
                      ) : (
                        <span className="text-white text-[8px] font-bold">
                          {connection.name?.charAt(0).toUpperCase() || 'B'}
                        </span>
                      )}
                    </div>
                    {connection.name || connection.id}
                  </div>

                  {/* Main output */}
                  <div className="ml-5 space-y-1">
                    {(() => {
                      const normalizeBlockName = (name: string) =>
                        name
                          .toLowerCase()
                          .replace(/\s+/g, '')
                          .replace(/[^a-z0-9]/g, '')
                      const blockRef = connection.name
                        ? normalizeBlockName(connection.name)
                        : connection.id
                      const mainTag = `<${blockRef}.response>`

                      return (
                        <button
                          className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors duration-150 group"
                          onClick={() => handleCopyTag(mainTag)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              <span className="text-sm">Complete Output</span>
                              <span className="text-xs text-muted-foreground">(full response)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                                {mainTag}
                              </span>
                              {copiedTag === mainTag ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })()}

                    {/* Response format fields */}
                    {fields.map((field) => {
                      const normalizeBlockName = (name: string) =>
                        name
                          .toLowerCase()
                          .replace(/\s+/g, '')
                          .replace(/[^a-z0-9]/g, '')
                      const blockRef = connection.name
                        ? normalizeBlockName(connection.name)
                        : connection.id
                      const tag =
                        field.name === 'response'
                          ? `<${blockRef}.response>` // If field is already "response", don't duplicate
                          : `<${blockRef}.response.${field.name}>`
                      return (
                        <button
                          key={field.name}
                          className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors duration-150 group"
                          onClick={() => handleCopyTag(tag)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                              <span className="text-sm font-medium">{field.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({field.type})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                                {tag}
                              </span>
                              {copiedTag === tag ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </div>
                          {field.description && (
                            <p className="text-xs text-muted-foreground/70 ml-4 mt-0.5">
                              {field.description}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-3 py-2 border-t border-border/40 bg-muted/10">
            <p className="text-xs text-muted-foreground">
              💡 Click any connection to copy its tag, then paste it into your input fields
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
