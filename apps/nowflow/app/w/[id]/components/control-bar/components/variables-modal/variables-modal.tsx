'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Variables } from '@/app/w/[id]/components/panel/components/variables/variables'

interface VariablesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VariablesModal({ open, onOpenChange }: VariablesModalProps) {
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[99] bg-transparent" onClick={() => onOpenChange(false)} />
      {/* Modal */}
      <div className="silver-glass-panel fixed bottom-6 right-6 z-[100] w-[450px] max-w-[calc(100vw-3rem)] h-[400px] max-h-[calc(100dvh-6rem)] rounded-[16px] border border-black/[0.06] dark:border-white/[0.06] flex flex-col bg-transparent shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        {/* Header with title and close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="text-[15px] font-logo font-semibold text-black/85 dark:text-white/90">
            Variables
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="silver-glass-chip h-7 w-7 rounded-[10px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-200"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 text-black/50 dark:text-white/60" strokeWidth={1.5} />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Variables content */}
        <div className="flex-1 overflow-y-auto p-3">
          <Variables panelWidth={450} />
        </div>
      </div>
    </>
  )
}
