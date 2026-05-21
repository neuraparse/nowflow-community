import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  ModernClockIcon,
  ModernUserIcon,
  ModernWorkflowIcon,
} from '@/components/modern-panel-content-icons'
import { JSONView } from '../../../console/components/json-view/json-view'

interface ChatMessageProps {
  message: {
    id: string
    content: any
    timestamp: string | Date
    type: 'user' | 'workflow'
    isStreaming?: boolean
  }
  containerWidth: number
}

// Maximum character length for a word before it's broken up
const MAX_WORD_LENGTH = 25

const WordWrap = ({ text }: { text: string }) => {
  if (!text) return null

  // Split text into words, keeping spaces and punctuation
  const parts = text.split(/(\s+)/g)

  return (
    <>
      {parts.map((part, index) => {
        // If the part is whitespace or shorter than the max length, render it as is
        if (part.match(/\s+/) || part.length <= MAX_WORD_LENGTH) {
          return <span key={index}>{part}</span>
        }

        // For long words, break them up into chunks
        const chunks = []
        for (let i = 0; i < part.length; i += MAX_WORD_LENGTH) {
          chunks.push(part.substring(i, i + MAX_WORD_LENGTH))
        }

        return (
          <span key={index} className="break-all">
            {chunks.map((chunk, chunkIndex) => (
              <span key={chunkIndex}>{chunk}</span>
            ))}
          </span>
        )
      })}
    </>
  )
}

export function ChatMessage({ message, containerWidth }: ChatMessageProps) {
  const messageDate = useMemo(() => new Date(message.timestamp), [message.timestamp])

  const relativeTime = useMemo(() => {
    return formatDistanceToNow(messageDate, { addSuffix: true })
  }, [messageDate])

  // Check if content is a JSON object
  const isJsonObject = useMemo(() => {
    return typeof message.content === 'object' && message.content !== null
  }, [message.content])

  // Format message content based on type
  const formattedContent = useMemo(() => {
    if (isJsonObject) {
      return JSON.stringify(message.content) // Return stringified version for type safety
    }

    return String(message.content || '')
  }, [message.content, isJsonObject])

  return (
    <div
      className={`w-full transition-all duration-300 ${
        message.type === 'user'
          ? 'hover:bg-[linear-gradient(90deg,rgba(74,122,104,0.05),transparent)] dark:hover:bg-[linear-gradient(90deg,rgba(148,184,166,0.06),transparent)]'
          : 'hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.18),transparent)] dark:hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.03),transparent)]'
      }`}
    >
      <div className="px-4 py-4 space-y-3">
        {/* Header with enhanced styling */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <div className="silver-glass-chip flex items-center gap-1.5 rounded-full px-2 py-1">
              <ModernClockIcon className="h-3 w-3 text-zinc-400 dark:text-white/40" />
              <span className="font-logo text-zinc-500 dark:text-white/45">{relativeTime}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {message.type === 'user' ? (
              <div className="silver-glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-zinc-700 dark:text-white/68">
                <ModernUserIcon className="h-3.5 w-3.5" />
                <span className="font-logo font-semibold">You</span>
              </div>
            ) : (
              <div className="silver-glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[#4A7A68] dark:text-[#94B8A6]">
                <ModernWorkflowIcon className="h-3.5 w-3.5" />
                <span className="font-logo font-semibold">Workflow</span>
              </div>
            )}
            {message.isStreaming && (
              <div className="silver-glass-chip flex items-center gap-1 rounded-full px-2 py-1 text-[#4A7A68] dark:text-[#94B8A6]">
                <div className="flex gap-0.5">
                  <div className="h-1 w-1 rounded-full bg-[#4A7A68] animate-pulse dark:bg-[#94B8A6]"></div>
                  <div
                    className="h-1 w-1 rounded-full bg-[#4A7A68] animate-pulse dark:bg-[#94B8A6]"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="h-1 w-1 rounded-full bg-[#4A7A68] animate-pulse dark:bg-[#94B8A6]"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                </div>
                <span className="font-logo text-xs font-medium">Streaming</span>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced message content */}
        <div
          className={`text-sm flex-1 break-normal whitespace-normal overflow-wrap-anywhere relative p-4 rounded-xl border transition-all duration-300 ${
            message.type === 'user'
              ? 'border-[#4A7A68]/14 bg-[linear-gradient(145deg,rgba(92,112,103,0.16),rgba(255,255,255,0.50))] font-medium shadow-[0_14px_32px_rgba(24,24,24,0.08)] hover:shadow-[0_18px_34px_rgba(24,24,24,0.10)] dark:border-[#94B8A6]/18 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))]'
              : 'silver-glass-pane border-black/[0.06] font-mono shadow-[0_14px_32px_rgba(24,24,24,0.06)] hover:shadow-[0_18px_34px_rgba(24,24,24,0.08)] dark:border-white/[0.08]'
          }`}
        >
          {isJsonObject ? (
            <div className="silver-glass-pane rounded-lg border-black/[0.06] p-3 dark:border-white/[0.08]">
              <JSONView data={message.content} initiallyExpanded={false} />
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words leading-relaxed text-zinc-700 dark:text-white/82">
              <WordWrap text={formattedContent} />
              {message.isStreaming && (
                <span className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-gradient-to-b from-[#4A7A68] to-[#4A7A68]/60 dark:from-[#94B8A6] dark:to-[#94B8A6]/60"></span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subtle separator */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.06]"></div>
    </div>
  )
}
