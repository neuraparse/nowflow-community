'use client'

import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

/**
 * ErrorMessageProps interface - defines the properties for the ErrorMessage component
 * @property {string | null} message - The error message to display, or null if no error
 */
interface ErrorMessageProps {
  message: string | null
}

/**
 * ErrorMessage component - Displays an error message with animation
 * Only renders when a message is provided, otherwise returns null
 * Uses Framer Motion for smooth entrance animation
 */
export function ErrorMessage({ message }: ErrorMessageProps) {
  // Don't render anything if there's no message
  if (!message) return null

  return (
    <motion.div
      className="silver-glass-pane smoky-glass-pane mb-8 rounded-xl border border-rose-500/[0.16] bg-rose-500/[0.05] p-4 text-rose-700 dark:border-rose-400/[0.14] dark:bg-rose-400/[0.06] dark:text-rose-100"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className="flex items-center gap-2 text-[12px] font-logo">
        <span className="smoky-glass-chip flex h-7 w-7 items-center justify-center rounded-[10px] border border-rose-500/[0.16] bg-rose-500/[0.08] dark:border-rose-400/[0.14] dark:bg-rose-400/[0.08]">
          <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-300" />
        </span>
        {message}
      </p>
    </motion.div>
  )
}
