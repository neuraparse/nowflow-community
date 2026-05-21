import { ConvertKitIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createSimpleToolConfig,
  defineBlock,
} from '../helpers'

export const ConvertKitBlock = defineBlock({
  type: 'convertkit',
  name: 'ConvertKit',
  description: 'Email marketing platform for creators',
  longDescription:
    'Integrate with ConvertKit (Kit) to manage email subscribers, create broadcasts, build landing pages, and automate email sequences. Perfect for bloggers, YouTubers, and online creators with OAuth 2.0 authentication (PKCE optional, higher rate limits).',
  category: 'tools',
  bgColor: '#FB6970',
  icon: ConvertKitIcon,
  subBlocks: [
    createOAuthSubBlock({
      title: 'ConvertKit Account',
      provider: 'convertkit',
      serviceId: 'convertkit',
      requiredScopes: [],
    }),
    createOperationDropdown({
      operations: [
        { id: 'add_subscriber', label: 'Add Subscriber' },
        { id: 'get_subscriber', label: 'Get Subscriber' },
        { id: 'list_subscribers', label: 'List Subscribers' },
        { id: 'update_subscriber', label: 'Update Subscriber' },
        { id: 'add_tag', label: 'Add Tag to Subscriber' },
        { id: 'remove_tag', label: 'Remove Tag' },
        { id: 'create_broadcast', label: 'Create Broadcast' },
        { id: 'list_broadcasts', label: 'List Broadcasts' },
        { id: 'list_forms', label: 'List Forms' },
        { id: 'list_sequences', label: 'List Sequences' },
      ],
      defaultValue: 'list_subscribers',
    }),
    {
      id: 'subscriberId',
      title: 'Subscriber ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter subscriber ID',
      condition: {
        field: 'operation',
        value: ['get_subscriber', 'update_subscriber', 'add_tag', 'remove_tag'],
      },
    },
    {
      id: 'email',
      title: 'Email',
      type: 'short-input',
      layout: 'full',
      placeholder: 'creator@example.com',
      condition: { field: 'operation', value: ['add_subscriber', 'update_subscriber'] },
    },
    {
      id: 'firstName',
      title: 'First Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Creator',
      condition: { field: 'operation', value: ['add_subscriber', 'update_subscriber'] },
    },
    {
      id: 'tagId',
      title: 'Tag ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter tag ID',
      condition: { field: 'operation', value: ['add_tag', 'remove_tag'] },
    },
    {
      id: 'subject',
      title: 'Broadcast Subject',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Email subject line',
      condition: { field: 'operation', value: 'create_broadcast' },
    },
    {
      id: 'content',
      title: 'Broadcast Content (HTML)',
      type: 'long-input',
      layout: 'full',
      placeholder: '<p>Your email content here</p>',
      condition: { field: 'operation', value: 'create_broadcast' },
    },
  ],
  tools: {
    access: ['convertkit_api'],
    config: createSimpleToolConfig('convertkit_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    subscriberId: { type: 'string', required: false },
    email: { type: 'string', required: false },
    firstName: { type: 'string', required: false },
    tagId: { type: 'string', required: false },
    subject: { type: 'string', required: false },
    content: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
