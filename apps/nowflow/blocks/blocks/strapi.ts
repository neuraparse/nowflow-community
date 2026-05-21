import { StrapiIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const StrapiBlock = defineBlock({
  type: 'strapi',
  name: 'Strapi',
  description: 'Open-source headless CMS with full customization',
  longDescription:
    'Integrate with Strapi to manage content collections, create entries, handle media, and customize your content API. Self-hosted or cloud, with full backend control and REST/GraphQL APIs with API token authentication.',
  category: 'tools',
  bgColor: '#4945FF',
  icon: StrapiIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Strapi API Token',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Strapi API token',
    },
    {
      id: 'apiUrl',
      title: 'Strapi API URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'https://your-strapi-instance.com',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_entries', label: 'List Entries' },
        { id: 'get_entry', label: 'Get Entry' },
        { id: 'create_entry', label: 'Create Entry' },
        { id: 'update_entry', label: 'Update Entry' },
        { id: 'delete_entry', label: 'Delete Entry' },
        { id: 'upload_media', label: 'Upload Media' },
        { id: 'list_media', label: 'List Media' },
      ],
      defaultValue: 'list_entries',
    }),
    {
      id: 'collection',
      title: 'Collection Type',
      type: 'short-input',
      layout: 'full',
      placeholder: 'articles, products, pages',
    },
    {
      id: 'entryId',
      title: 'Entry ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter entry ID',
      condition: { field: 'operation', value: ['get_entry', 'update_entry', 'delete_entry'] },
    },
    {
      id: 'data',
      title: 'Entry Data (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"data": {"title": "My Article", "content": "..."}}',
      condition: { field: 'operation', value: ['create_entry', 'update_entry'] },
    },
    {
      id: 'filters',
      title: 'Filters (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"filters": {"title": {"$contains": "React"}}}',
      condition: { field: 'operation', value: 'list_entries' },
    },
  ],
  tools: {
    access: ['strapi_api'],
    config: {
      tool: () => 'strapi_api',
      params: (params) => {
        const { credential, data, filters, ...rest } = params as Record<string, any>
        return {
          credential,
          data: data ? JSON.parse(data) : undefined,
          filters: filters ? JSON.parse(filters) : undefined,
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    apiUrl: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    collection: { type: 'string', required: true },
    entryId: { type: 'string', required: false },
    data: { type: 'string', required: false },
    filters: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
