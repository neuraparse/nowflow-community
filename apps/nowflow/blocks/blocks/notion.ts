import { NotionIcon } from '@/components/icons'
import { NotionResponse } from '@/tools/notion/types'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  defineBlock,
  parseJsonStrict,
} from '../helpers'

export const NotionBlock = defineBlock<NotionResponse>({
  type: 'notion',
  name: 'Notion',
  description: 'Manage Notion pages',
  longDescription:
    'Integrate with Notion to read content from pages, write new content, and create new pages.',
  category: 'tools',
  bgColor: '#181C1E',
  icon: NotionIcon,
  subBlocks: [
    createOperationDropdown({
      operations: [
        { id: 'read_notion', label: 'Read Page' },
        { id: 'write_notion', label: 'Append Content' },
        { id: 'create_notion', label: 'Create Page' },
      ],
    }),
    createOAuthSubBlock({
      provider: 'notion',
      serviceId: 'notion',
      requiredScopes: ['workspace.content', 'workspace.name', 'page.read', 'page.write'],
      title: 'Notion Account',
      placeholder: 'Select Notion account',
    }),
    // Read/Write operation - Page ID
    {
      id: 'pageId',
      title: 'Page ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Notion page ID',
      condition: {
        field: 'operation',
        value: 'read_notion',
      },
    },
    {
      id: 'pageId',
      title: 'Page ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Notion page ID',
      condition: {
        field: 'operation',
        value: 'write_notion',
      },
    },
    // Create operation fields
    {
      id: 'parentType',
      title: 'Parent Type',
      type: 'dropdown',
      layout: 'full',
      options: [
        { label: 'Page', id: 'page' },
        { label: 'Database', id: 'database' },
      ],
      condition: { field: 'operation', value: 'create_notion' },
    },
    {
      id: 'parentId',
      title: 'Parent ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of parent page or database',
      condition: { field: 'operation', value: 'create_notion' },
    },
    {
      id: 'title',
      title: 'Page Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Title for the new page',
      condition: {
        field: 'operation',
        value: 'create_notion',
        and: { field: 'parentType', value: 'page' },
      },
    },
    {
      id: 'properties',
      title: 'Page Properties (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter page properties as JSON object',
      condition: {
        field: 'operation',
        value: 'create_notion',
      },
    },
    // Content input for write/create operations
    {
      id: 'content',
      title: 'Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter content to add to the page',
      condition: {
        field: 'operation',
        value: 'write_notion',
      },
    },
    {
      id: 'content',
      title: 'Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter content to add to the page',
      condition: {
        field: 'operation',
        value: 'create_notion',
      },
    },
  ],
  tools: {
    access: ['notion_read', 'notion_write', 'notion_create_page'],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'read_notion':
            return 'notion_read'
          case 'write_notion':
            return 'notion_write'
          case 'create_notion':
            return 'notion_create_page'
          default:
            return 'notion_read'
        }
      },
      params: (params) => {
        const { credential, operation, properties, ...rest } = params

        const parsedProperties =
          operation === 'create_notion' && properties
            ? parseJsonStrict(properties, 'properties')
            : undefined

        return {
          ...rest,
          accessToken: credential,
          ...(parsedProperties ? { properties: parsedProperties } : {}),
        }
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    credential: { type: 'string', required: true },
    pageId: { type: 'string', required: false },
    content: { type: 'string', required: false },
    // Create page inputs
    parentType: { type: 'string', required: true },
    parentId: { type: 'string', required: true },
    title: { type: 'string', required: false },
    properties: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        metadata: 'json',
      },
    },
  },
})
