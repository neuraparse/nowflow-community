import { ToolConfig } from '../types'

interface TrelloCardsParams {
  key: string
  token: string
  boardId?: string
  listId?: string
  cardId?: string
  operation: 'list' | 'get' | 'create' | 'update'
  name?: string
  desc?: string
  due?: string
}

export const trelloCardsTool: ToolConfig<TrelloCardsParams> = {
  id: 'trello_cards',
  name: 'Trello Cards',
  description: 'List, get, create, and update Trello cards.',
  version: '1.0.0',

  params: {
    key: { type: 'string', required: true, requiredForToolCall: true },
    token: { type: 'string', required: true, requiredForToolCall: true },
    boardId: { type: 'string', description: 'Board ID for listing cards (via /boards/{id}/cards)' },
    listId: { type: 'string', description: 'List ID for creating cards' },
    cardId: { type: 'string', description: 'Card ID for get/update' },
    operation: { type: 'string', required: true },
    name: { type: 'string', description: 'Card name (create/update)' },
    desc: { type: 'string', description: 'Card description (create/update)' },
    due: { type: 'string', description: 'Due date (create/update)' },
  },

  request: {
    url: (p) => {
      const base = 'https://api.trello.com/1'
      if (p.operation === 'list' && p.boardId)
        return `${base}/boards/${encodeURIComponent(p.boardId)}/cards`
      if (p.operation === 'get' && p.cardId) return `${base}/cards/${encodeURIComponent(p.cardId)}`
      if ((p.operation === 'create' || p.operation === 'update') && p.cardId)
        return `${base}/cards/${encodeURIComponent(p.cardId)}`
      if (p.operation === 'create' && p.listId) return `${base}/cards`
      return `${base}/cards`
    },
    method: (p) => {
      switch (p.operation) {
        case 'list':
        case 'get':
          return 'GET'
        case 'create':
          return 'POST'
        case 'update':
          return 'PUT'
        default:
          return 'GET'
      }
    },
    headers: () => ({ 'Content-Type': 'application/json' }),
    query: (p) => {
      const q: Record<string, string> = { key: p.key, token: p.token }
      if (p.operation === 'list' && p.boardId) return q
      if (p.operation === 'get' && p.cardId) return q
      if (p.operation === 'create' && p.listId)
        return { ...q, idList: p.listId, name: p.name || '', desc: p.desc || '', due: p.due || '' }
      if (p.operation === 'update' && p.cardId)
        return { ...q, name: p.name || '', desc: p.desc || '', due: p.due || '' }
      return q
    },
    body: () => undefined as any,
  },

  transformResponse: async (response) => {
    const isJson = response.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await response.json() : await response.text()
    if (!response.ok) {
      const message =
        (data as any)?.message || (typeof data === 'string' ? data : 'Trello request failed')
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },

  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Trello request failed',
}
