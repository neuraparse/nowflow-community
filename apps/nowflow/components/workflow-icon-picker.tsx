'use client'

import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  DEFAULT_WORKFLOW_ICON,
  getWorkflowIconById,
  getWorkflowIconsByCategory,
  WORKFLOW_ICONS,
  WorkflowIcon,
} from './workflow-icons'

interface WorkflowIconPickerProps {
  selectedIconId?: string
  onIconSelect: (iconId: string) => void
  trigger?: React.ReactNode
  className?: string
}

export function WorkflowIconPicker({
  selectedIconId,
  onIconSelect,
  trigger,
  className,
}: WorkflowIconPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedIcon = selectedIconId ? getWorkflowIconById(selectedIconId) : DEFAULT_WORKFLOW_ICON
  const categories = getWorkflowIconsByCategory()

  // Filter icons based on search query
  const filteredIcons = searchQuery
    ? WORKFLOW_ICONS.filter(
        (icon) =>
          icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          icon.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  const handleIconSelect = (iconId: string) => {
    onIconSelect(iconId)
    setOpen(false)
    setSearchQuery('')
  }

  const IconButton = ({
    icon,
    isSelected = false,
  }: {
    icon: WorkflowIcon
    isSelected?: boolean
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'relative h-10 w-10 rounded-md border p-0 transition-colors duration-150',
        isSelected
          ? 'border-primary bg-muted text-foreground'
          : 'border-transparent hover:border-border hover:bg-muted/60'
      )}
      onClick={() => handleIconSelect(icon.id)}
    >
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center"
        style={{ color: icon.color }}
      >
        <icon.icon className="h-4 w-4" />
      </div>
      {isSelected && (
        <div className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary">
          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={2} />
        </div>
      )}
    </Button>
  )

  const defaultTrigger = (
    <Button variant="outline" size="sm" className={cn('h-10 w-10 rounded-md p-0', className)}>
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center"
        style={{ color: selectedIcon.color }}
      >
        <selectedIcon.icon className="h-4 w-4" />
      </div>
    </Button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger || defaultTrigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 border-b">
          <h4 className="font-medium text-sm mb-3">Choose Icon</h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <ScrollArea className="h-80">
          {filteredIcons ? (
            // Search results
            <div className="p-4">
              <div className="grid grid-cols-6 gap-2">
                {filteredIcons.map((icon) => (
                  <IconButton key={icon.id} icon={icon} isSelected={selectedIconId === icon.id} />
                ))}
              </div>
              {filteredIcons.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No icons found</div>
              )}
            </div>
          ) : (
            // Categories
            <Tabs defaultValue={Object.keys(categories)[0]} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1 m-2 mr-4">
                {Object.keys(categories)
                  .slice(0, 3)
                  .map((category) => (
                    <TabsTrigger
                      key={category}
                      value={category}
                      className="text-xs px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {category.split(' ')[0]}
                    </TabsTrigger>
                  ))}
              </TabsList>

              {Object.entries(categories)
                .slice(0, 3)
                .map(([category, icons]) => (
                  <TabsContent key={category} value={category} className="p-4 pt-2">
                    <div className="grid grid-cols-6 gap-2">
                      {icons.map((icon) => (
                        <IconButton
                          key={icon.id}
                          icon={icon}
                          isSelected={selectedIconId === icon.id}
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}

              {/* Additional categories in a scrollable section */}
              {Object.keys(categories).length > 3 && (
                <div className="border-t p-4">
                  <h5 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                    More Categories
                  </h5>
                  {Object.entries(categories)
                    .slice(3)
                    .map(([category, icons]) => (
                      <div key={category} className="mb-4">
                        <h6 className="text-xs font-medium mb-2">{category}</h6>
                        <div className="grid grid-cols-6 gap-2">
                          {icons.map((icon) => (
                            <IconButton
                              key={icon.id}
                              icon={icon}
                              isSelected={selectedIconId === icon.id}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Tabs>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
