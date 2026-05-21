import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { safeStorage } from '@/stores/safe-storage'

export interface DeployedChatMessage {
  id: string
  content: string | Record<string, any>
  type: 'user' | 'assistant'
  timestamp: Date
}

export interface DeployedChatStore {
  // Messages per subdomain
  messagesBySubdomain: Record<string, DeployedChatMessage[]>

  // Add message to a specific subdomain (returns the message ID)
  addMessage: (subdomain: string, message: Omit<DeployedChatMessage, 'id' | 'timestamp'>) => string

  // Get messages for a specific subdomain
  getMessages: (subdomain: string) => DeployedChatMessage[]

  // Clear messages for a specific subdomain
  clearMessages: (subdomain: string) => void

  // Clear all messages
  clearAllMessages: () => void

  // Append content to a streaming message
  appendMessageContent: (subdomain: string, messageId: string, content: string) => void
}

const MAX_MESSAGES_PER_SUBDOMAIN = 100

function normalizeMessage(message: DeployedChatMessage): DeployedChatMessage {
  return {
    ...message,
    timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
  }
}

export const useDeployedChatStore = create<DeployedChatStore>()(
  devtools(
    persist(
      (set, get) => ({
        messagesBySubdomain: {},

        addMessage: (subdomain, message) => {
          const messageId = crypto.randomUUID()
          set((state) => {
            const newMessage: DeployedChatMessage = {
              ...message,
              id: messageId,
              timestamp: new Date(),
            }

            const existingMessages = state.messagesBySubdomain[subdomain] || []
            const newMessages = [newMessage, ...existingMessages].slice(
              0,
              MAX_MESSAGES_PER_SUBDOMAIN
            )

            return {
              messagesBySubdomain: {
                ...state.messagesBySubdomain,
                [subdomain]: newMessages,
              },
            }
          })
          return messageId
        },

        getMessages: (subdomain) => {
          const messages = get().messagesBySubdomain[subdomain] || []
          // Return in chronological order (oldest first)
          return [...messages].reverse().map(normalizeMessage)
        },

        clearMessages: (subdomain) => {
          set((state) => {
            const newMessagesBySubdomain = { ...state.messagesBySubdomain }
            delete newMessagesBySubdomain[subdomain]
            return { messagesBySubdomain: newMessagesBySubdomain }
          })
        },

        clearAllMessages: () => {
          set({ messagesBySubdomain: {} })
        },

        appendMessageContent: (subdomain, messageId, content) => {
          set((state) => {
            const existingMessages = state.messagesBySubdomain[subdomain] || []
            const newMessages = existingMessages.map((message) => {
              if (message.id === messageId) {
                return {
                  ...message,
                  content:
                    typeof message.content === 'string'
                      ? message.content + content
                      : message.content
                        ? String(message.content) + content
                        : content,
                }
              }
              return message
            })

            return {
              messagesBySubdomain: {
                ...state.messagesBySubdomain,
                [subdomain]: newMessages,
              },
            }
          })
        },
      }),
      {
        name: 'deployed-chat-store',
        storage: safeStorage,
      }
    )
  )
)
