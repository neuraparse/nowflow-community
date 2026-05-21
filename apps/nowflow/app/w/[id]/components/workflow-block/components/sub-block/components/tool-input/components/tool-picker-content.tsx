import { WrenchIcon } from 'lucide-react'
import { StoredTool } from '../utils'
import { ToolCommand } from './tool-command/tool-command'

interface ToolPickerContentProps {
  customFilter: (value: string, search: string) => number
  setSearchQuery: (query: string) => void
  customTools: Array<{ id: string; title: string; schema: any; code?: string }>
  toolBlocks: Array<{ type: string; name: string; bgColor: string; icon: any }>
  searchQuery: string
  selectedTools: StoredTool[]
  isWide: boolean | undefined
  onSelectTool: (toolBlock: { type: string; name: string; bgColor: string; icon: any }) => void
  onSelectCustomTool: (customTool: {
    id: string
    title: string
    schema: any
    code?: string
  }) => void
  onCreateTool: () => void
  onClose: () => void
}

function IconComponent({ icon: Icon, className }: { icon: any; className?: string }) {
  if (!Icon) return null
  return <Icon className={className} />
}

export function ToolPickerContent({
  customFilter,
  setSearchQuery,
  customTools,
  toolBlocks,
  searchQuery,
  selectedTools,
  isWide,
  onSelectTool,
  onSelectCustomTool,
  onCreateTool,
  onClose,
}: ToolPickerContentProps) {
  return (
    <ToolCommand.Root filter={customFilter}>
      <ToolCommand.Input placeholder="Search tools..." onValueChange={setSearchQuery} />
      <ToolCommand.List>
        <ToolCommand.Empty>No tools found.</ToolCommand.Empty>
        <ToolCommand.Group>
          <ToolCommand.Item
            value="Create Tool"
            onSelect={() => {
              onClose()
              onCreateTool()
            }}
            className="flex items-center gap-2 cursor-pointer mb-1"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded border border-dashed border-muted-foreground/50 bg-transparent">
              <WrenchIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span>Create Tool</span>
          </ToolCommand.Item>

          {/* Display saved custom tools at the top */}
          {customTools.length > 0 && (
            <>
              <ToolCommand.Separator />
              <div className="px-2 pt-2.5 pb-0.5 text-xs font-medium text-muted-foreground">
                Custom Tools
              </div>
              <ToolCommand.Group className="-mx-1 -px-1">
                {customTools.map((customTool) => (
                  <ToolCommand.Item
                    key={customTool.id}
                    value={customTool.title}
                    onSelect={() => {
                      onSelectCustomTool(customTool)
                      onClose()
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-500">
                      <WrenchIcon className="w-4 h-4 text-white" />
                    </div>
                    <span className="truncate max-w-[140px]">{customTool.title}</span>
                  </ToolCommand.Item>
                ))}
              </ToolCommand.Group>
              <ToolCommand.Separator />
            </>
          )}

          {/* Display built-in tools */}
          {toolBlocks.some((block) => customFilter(block.name, searchQuery || '') > 0) && (
            <>
              <div className="px-2 pt-2.5 pb-0.5 text-xs font-medium text-muted-foreground">
                Built-in Tools
              </div>
              <ToolCommand.Group className="-mx-1 -px-1">
                {toolBlocks.map((block) => (
                  <ToolCommand.Item
                    key={block.type}
                    value={block.name}
                    onSelect={() => onSelectTool(block)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded"
                      style={{ backgroundColor: block.bgColor }}
                    >
                      <IconComponent icon={block.icon} className="w-4 h-4 text-white" />
                    </div>
                    <span className="truncate max-w-[140px]">{block.name}</span>
                  </ToolCommand.Item>
                ))}
              </ToolCommand.Group>
            </>
          )}
        </ToolCommand.Group>
      </ToolCommand.List>
    </ToolCommand.Root>
  )
}
