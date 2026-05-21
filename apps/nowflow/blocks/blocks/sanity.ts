import { SanityIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const SanityBlock = defineBlock({
  type: 'sanity',
  name: 'Sanity',
  description: 'Real-time headless CMS with GROQ query language',
  longDescription:
    'Integrate with Sanity CMS for real-time collaborative content editing, GROQ queries, document management, and structured content. Features live updates and developer-centric workflows with OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#F03E2F',
  icon: SanityIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'sanity',
      serviceId: 'sanity',
      requiredScopes: [],
      title: 'Sanity Account',
      placeholder: 'Select Sanity account',
    }),
    {
      id: 'projectId',
      title: 'Project ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter project ID',
    },
    {
      id: 'dataset',
      title: 'Dataset',
      type: 'short-input',
      layout: 'half',
      placeholder: 'production, staging',
    },
    createOperationDropdown({
      operations: [
        { id: 'query', label: 'GROQ Query' },
        { id: 'get_document', label: 'Get Document' },
        { id: 'create_document', label: 'Create Document' },
        { id: 'update_document', label: 'Update Document' },
        { id: 'delete_document', label: 'Delete Document' },
        { id: 'list_documents', label: 'List Documents' },
      ],
      defaultValue: 'query',
    }),
    {
      id: 'groqQuery',
      title: 'GROQ Query',
      type: 'long-input',
      layout: 'full',
      placeholder: '*[_type == "post"]{title, slug, body}',
      condition: { field: 'operation', value: 'query' },
    },
    {
      id: 'documentId',
      title: 'Document ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter document ID',
      condition: {
        field: 'operation',
        value: ['get_document', 'update_document', 'delete_document'],
      },
    },
    {
      id: 'documentType',
      title: 'Document Type',
      type: 'short-input',
      layout: 'full',
      placeholder: 'post, author, category',
      condition: { field: 'operation', value: ['create_document', 'list_documents'] },
    },
    {
      id: 'document',
      title: 'Document Data (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"_type": "post", "title": "My Post", "body": "Content..."}',
      condition: { field: 'operation', value: ['create_document', 'update_document'] },
    },
  ],
  tools: {
    access: ['sanity_api'],
    config: {
      tool: () => 'sanity_api',
      params: createParamTransformer({ document: 'json' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    projectId: { type: 'string', required: true },
    dataset: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    groqQuery: { type: 'string', required: false },
    documentId: { type: 'string', required: false },
    documentType: { type: 'string', required: false },
    document: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
