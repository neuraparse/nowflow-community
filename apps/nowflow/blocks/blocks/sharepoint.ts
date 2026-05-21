import { SharePointIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const SharePointBlock = defineBlock({
  type: 'sharepoint',
  name: 'Microsoft SharePoint',
  description: 'List SharePoint lists and manage list items via Microsoft Graph.',
  longDescription: 'Use Microsoft Graph to access SharePoint sites, lists and items with OAuth.',
  category: 'tools',
  bgColor: '#036C70',
  icon: SharePointIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'microsoft-sharepoint',
      serviceId: 'microsoft-sharepoint',
      requiredScopes: [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/Sites.ReadWrite.All',
        'https://graph.microsoft.com/Files.ReadWrite.All',
      ],
      title: 'SharePoint Account',
      placeholder: 'Select Microsoft account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_lists', label: 'List Lists' },
        { id: 'list_items', label: 'List Items' },
        { id: 'get_item', label: 'Get Item' },
        { id: 'create_item', label: 'Create Item' },
        { id: 'update_item', label: 'Update Item' },
      ],
    }),
    { id: 'siteId', title: 'Site ID', type: 'short-input', layout: 'full' },
    { id: 'listId', title: 'List ID', type: 'short-input', layout: 'half' },
    { id: 'itemId', title: 'Item ID', type: 'short-input', layout: 'half' },
    { id: 'fields', title: 'Fields (JSON)', type: 'long-input', layout: 'full' },
  ],
  tools: {
    access: ['sharepoint_lists'],
    config: {
      tool: () => 'sharepoint_lists',
      params: (params) => {
        const { credential, operation, siteId, listId, itemId, fields } = params as Record<
          string,
          any
        >
        return {
          accessToken: credential,
          operation,
          siteId,
          listId,
          itemId,
          fields: typeof fields === 'string' ? safeParseJson(fields) : fields,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    siteId: { type: 'string', required: true },
    listId: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    fields: { type: 'json', required: false },
  },
  outputs: { response: { type: { data: 'json' } } },
})

function safeParseJson(s?: string) {
  if (!s) return undefined
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}
