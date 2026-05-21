import { ShopifyIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const ShopifyBlock = defineBlock({
  type: 'shopify',
  name: 'Shopify',
  description: 'Shopify Admin API operations (orders list/get/create).',
  longDescription:
    'Interact with Shopify Admin REST API for orders: list, retrieve, and create. Provide shop domain and API access token.',
  category: 'tools',
  bgColor: '#95BF47',
  icon: ShopifyIcon,
  subBlocks: [
    {
      id: 'shopDomain',
      title: 'Shop Domain',
      type: 'short-input',
      layout: 'full',
      placeholder: 'your-store.myshopify.com',
    },
    {
      id: 'accessToken',
      title: 'Access Token',
      type: 'short-input',
      layout: 'full',
      password: true,
    },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Orders' },
        { id: 'get', label: 'Get Order' },
        { id: 'create', label: 'Create Order' },
      ],
    }),
    { id: 'orderId', title: 'Order ID', type: 'short-input', layout: 'full' },
    { id: 'status', title: 'Status (list)', type: 'short-input', layout: 'half' },
    { id: 'limit', title: 'Limit', type: 'short-input', layout: 'half' },
    { id: 'fields', title: 'Fields', type: 'short-input', layout: 'full' },
    { id: 'pageInfo', title: 'Page Info', type: 'short-input', layout: 'full' },
    {
      id: 'apiVersion',
      title: 'API Version',
      type: 'short-input',
      layout: 'half',
      placeholder: '2025-10',
    },
    {
      id: 'data',
      title: 'Payload (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{\n  "email": "customer@example.com"\n}',
    },
  ],
  tools: {
    access: ['shopify_orders'],
    config: {
      tool: () => 'shopify_orders',
      params: (params) => {
        const {
          shopDomain,
          accessToken,
          operation,
          orderId,
          status,
          limit,
          fields,
          pageInfo,
          apiVersion,
          data,
        } = params as Record<string, any>
        const parseJSON = (v: any) => {
          if (typeof v === 'string' && v.trim()) {
            try {
              return JSON.parse(v)
            } catch {
              return undefined
            }
          }
          return v
        }
        const toNum = (v: any) => (typeof v === 'string' ? (v.trim() ? Number(v) : undefined) : v)
        return {
          shopDomain,
          accessToken,
          operation,
          orderId,
          status,
          limit: toNum(limit),
          fields,
          pageInfo,
          apiVersion,
          data: parseJSON(data),
        }
      },
    },
  },
  inputs: {
    shopDomain: { type: 'string', required: true },
    accessToken: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    orderId: { type: 'string', required: false },
    status: { type: 'string', required: false },
    limit: { type: 'string', required: false },
    fields: { type: 'string', required: false },
    pageInfo: { type: 'string', required: false },
    apiVersion: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
