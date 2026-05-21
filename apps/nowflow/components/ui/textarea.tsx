import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, style, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'workflow-editor-field unstyled-editor-field workflow-editor-textarea-field glass-textarea flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2.5 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-[color,background-color,border-color,box-shadow] duration-150',
          className
        )}
        style={style}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
