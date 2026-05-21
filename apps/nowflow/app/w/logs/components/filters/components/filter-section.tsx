import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export default function FilterSection({
  title,
  defaultOpen = false,
  content,
}: {
  title: string
  defaultOpen?: boolean
  content?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full justify-between px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.03] hover:text-zinc-800 dark:hover:text-white rounded-md transition-all duration-200"
        >
          <span className="text-zinc-600 dark:text-white/60 font-logo">{title}</span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 dark:text-white/40 transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 pb-1 overflow-hidden transition-all duration-300">
        <div className="bg-zinc-50/50 dark:bg-white/[0.02] p-2 rounded-md border border-black/[0.04] dark:border-white/[0.04] shadow-sm">
          {content || (
            <div className="text-sm text-zinc-400 dark:text-white/40">
              Filter options for {title} will go here
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
