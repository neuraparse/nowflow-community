'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createLogger } from '@/lib/logs/console-logger'
import { copyToClipboard as safeCopyToClipboard } from '@/lib/utils'

const logger = createLogger('copy-button')

interface CopyButtonProps {
  text: string
  className?: string
  showLabel?: boolean
}

export function CopyButton({ text, className = '', showLabel = true }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyToClipboard = async () => {
    try {
      const success = await safeCopyToClipboard(text)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        logger.warn('Failed to copy to clipboard')
      }
    } catch (error) {
      logger.error('Copy to clipboard error:', error)
    }
  }

  return (
    <div className="absolute top-1 right-1 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {showLabel && (
        <div className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
          {copied ? 'Copied!' : 'Click to copy'}
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-6 w-6 p-0 ${className}`}
        onClick={(e) => {
          e.stopPropagation() // Prevent click from affecting parent elements
          handleCopyToClipboard()
        }}
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </div>
  )
}
