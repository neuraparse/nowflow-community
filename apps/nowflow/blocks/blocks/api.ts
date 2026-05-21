import { ApiIcon } from '@/components/icons'
import { RequestResponse } from '@/tools/http/types'
import { BlockConfig } from '../types'

export const ApiBlock: BlockConfig<RequestResponse> = {
  type: 'api',
  name: 'HTTP Request',
  description: 'Make HTTP requests',
  longDescription:
    'Make HTTP requests to any API endpoint with support for all standard HTTP methods (GET, POST, PUT, DELETE, PATCH). Configure headers, query parameters, and request bodies. Standard headers (User-Agent, Accept, Cache-Control, etc.) are automatically included.',
  category: 'blocks',
  bgColor: '#2F55FF',
  icon: ApiIcon,
  subBlocks: [
    {
      id: 'url',
      title: 'URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://api.example.com/v1/users',
    },
    {
      id: 'method',
      title: 'Method',
      type: 'dropdown',
      layout: 'half',
      options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
    {
      id: 'params',
      title: 'Query Params',
      type: 'table',
      layout: 'full',
      columns: ['Key', 'Value'],
    },
    {
      id: 'headers',
      title: 'Headers',
      type: 'table',
      layout: 'full',
      columns: ['Key', 'Value'],
      description:
        'Custom headers (standard headers like User-Agent, Accept, etc. are added automatically)',
    },
    {
      id: 'body',
      title: 'Body',
      type: 'code',
      layout: 'full',
      placeholder: `{"name": "John Doe", "email": "john@example.com"}`,
    },
  ],
  tools: {
    access: ['http_request'],
    config: {
      tool: () => 'http_request',
      params: (params) => ({
        url: params.url,
        method: params.method,
        headers: params.headers,
        body: params.body,
        params: params.params,
      }),
    },
  },
  inputs: {
    url: { type: 'string', required: true },
    method: { type: 'string', required: true },
    headers: { type: 'json', required: false },
    body: { type: 'json', required: false },
    params: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
        status: 'number',
        headers: 'json',
      },
    },
  },
}
