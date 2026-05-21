'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ModernHelpIcon } from '@/components/modern-sidebar-icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HelpForm } from './components/help-form/help-form'

interface HelpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  // Listen for the custom event to open the help modal
  useEffect(() => {
    const handleOpenHelp = (_event: CustomEvent) => {
      onOpenChange(true)
    }

    // Add event listener
    window.addEventListener('open-help', handleOpenHelp as EventListener)

    // Clean up
    return () => {
      window.removeEventListener('open-help', handleOpenHelp as EventListener)
    }
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden rounded-[16px]"
        hideCloseButton
      >
        <DialogHeader className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#4A7A68]/[0.08] dark:bg-[#94B8A6]/[0.10]">
                <ModernHelpIcon className="h-4 w-4 text-[#4A7A68] dark:text-[#94B8A6]" />
              </div>
              <DialogTitle className="text-[15px] font-logo font-semibold text-zinc-800 dark:text-white">
                Help & Support
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-0 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-200"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4 text-black/50 dark:text-white/60" strokeWidth={1.5} />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <HelpForm onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
