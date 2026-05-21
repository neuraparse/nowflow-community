import { ToolConfig } from '../types'

interface MondayItemsParams {
  token: string
  operation: 'list' | 'get' | 'create' | 'update'
  boardId?: string
  itemId?: string
  data?: Record<string, any>
}

export const mondayItemsTool: ToolConfig<MondayItemsParams> = {
  id: 'monday_items',
  name: 'Monday.com Items',
  description: 'List, get, create, and update Monday.com items via GraphQL.',
  version: '1.0.0',

  params: {
    token: { type: 'string', required: true, requiredForToolCall: true },
    operation: { type: 'string', required: true },
    boardId: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    data: { type: 'object', required: false },
  },

  request: {
    url: () => 'https://api.monday.com/v2',
    method: () => 'POST',
    headers: (p) => ({
      Authorization: p.token,
      'Content-Type': 'application/json',
    }),
    body: (p) => {
      let query = ''
      let variables: Record<string, any> = {}

      switch (p.operation) {
        case 'list':
          query = `query($boardId: [ID!]) { boards (ids: $boardId) { items_page (limit: 50) { items { id name column_values { id text value } } } } }`
          variables = { boardId: Number(p.boardId) }
          break
        case 'get':
          query = `query($itemId: [ID!]) { items (ids: $itemId) { id name column_values { id text value } } }`
          variables = { itemId: Number(p.itemId) }
          break
        case 'create':
          query = `mutation($boardId: ID!, $itemName: String!, $columnValues: JSON) { create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) { id } }`
          variables = {
            boardId: Number(p.boardId),
            itemName: p.data?.name || 'New Item',
            columnValues: p.data?.columnValues ? JSON.stringify(p.data.columnValues) : undefined,
          }
          break
        case 'update':
          query = `mutation($itemId: ID!, $columnValues: JSON!) { change_multiple_column_values(item_id: $itemId, board_id: $boardId, column_values: $columnValues) { id } }`
          variables = {
            itemId: Number(p.itemId),
            boardId: Number(p.boardId),
            columnValues: p.data?.columnValues
              ? JSON.stringify(p.data.columnValues)
              : JSON.stringify({}),
          }
          break
        default:
          query = '{ me { id } }'
      }

      return { query, variables }
    },
  },

  transformResponse: async (response) => {
    const data = await response.json().catch(() => undefined)
    if (!response.ok || (data && data.errors)) {
      const message = data?.errors?.[0]?.message || 'Monday.com request failed'
      return { success: false, output: data as any, error: message }
    }
    return { success: true, output: data as any }
  },
  transformError: (error) =>
    typeof error === 'string' ? error : error?.message || 'Monday.com request failed',
}
