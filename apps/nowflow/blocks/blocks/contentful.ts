import { ContentfulIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const ContentfulBlock = defineBlock({
  type: 'contentful',
  name: 'Contentful',
  description: 'Enterprise headless CMS with powerful content APIs',
  longDescription:
    'Integrate with Contentful to manage content, create entries, work with assets, publish content across channels, and build omnichannel experiences. Perfect for enterprise-scale content operations with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#2478CC',
  icon: ContentfulIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'contentful',
      serviceId: 'contentful',
      requiredScopes: ['content_management_manage'],
      title: 'Contentful Account',
      placeholder: 'Select Contentful account',
    }),
    {
      id: 'spaceId',
      title: 'Space ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter space ID',
    },
    createOperationDropdown({
      operations: [
        { id: 'list_entries', label: 'List Entries' },
        { id: 'get_entry', label: 'Get Entry' },
        { id: 'create_entry', label: 'Create Entry' },
        { id: 'update_entry', label: 'Update Entry' },
        { id: 'publish_entry', label: 'Publish Entry' },
        { id: 'list_assets', label: 'List Assets' },
        { id: 'upload_asset', label: 'Upload Asset' },
        { id: 'list_content_types', label: 'List Content Types' },
      ],
      defaultValue: 'list_entries',
    }),
    {
      id: 'entryId',
      title: 'Entry ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter entry ID',
      condition: { field: 'operation', value: ['get_entry', 'update_entry', 'publish_entry'] },
    },
    {
      id: 'contentType',
      title: 'Content Type',
      type: 'short-input',
      layout: 'full',
      placeholder: 'blogPost, product, page',
      condition: { field: 'operation', value: ['create_entry', 'list_entries'] },
    },
    {
      id: 'fields',
      title: 'Entry Fields (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"title": {"en-US": "My Post"}, "body": {"en-US": "Content..."}}',
      condition: { field: 'operation', value: ['create_entry', 'update_entry'] },
    },
  ],
  tools: {
    access: ['contentful_api'],
    config: {
      tool: () => 'contentful_api',
      params: createParamTransformer({ fields: 'json' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    spaceId: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    entryId: { type: 'string', required: false },
    contentType: { type: 'string', required: false },
    fields: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
