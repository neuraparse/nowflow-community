import { KlaviyoIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const KlaviyoBlock = defineBlock({
  type: 'klaviyo',
  name: 'Klaviyo',
  description: 'Ecommerce email and SMS marketing platform',
  longDescription:
    'Integrate with Klaviyo for ecommerce marketing automation, personalized email campaigns, SMS marketing, customer segmentation, and analytics. Perfect for online stores with OAuth 2.0 authentication (PKCE required).',
  category: 'tools',
  bgColor: '#000000',
  icon: KlaviyoIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'klaviyo',
      serviceId: 'klaviyo',
      requiredScopes: [
        'profiles:read',
        'profiles:write',
        'campaigns:read',
        'campaigns:write',
        'metrics:read',
      ],
      title: 'Klaviyo Account',
      placeholder: 'Select Klaviyo account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_profile', label: 'Create Profile' },
        { id: 'get_profile', label: 'Get Profile' },
        { id: 'list_profiles', label: 'List Profiles' },
        { id: 'update_profile', label: 'Update Profile' },
        { id: 'create_event', label: 'Create Event' },
        { id: 'list_campaigns', label: 'List Campaigns' },
        { id: 'send_campaign', label: 'Send Campaign' },
        { id: 'list_metrics', label: 'List Metrics' },
        { id: 'get_metric', label: 'Get Metric' },
      ],
      defaultValue: 'list_profiles',
    }),
    {
      id: 'profileId',
      title: 'Profile ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter profile ID',
      condition: { field: 'operation', value: ['get_profile', 'update_profile'] },
    },
    {
      id: 'email',
      title: 'Email',
      type: 'short-input',
      layout: 'full',
      placeholder: 'customer@example.com',
      condition: { field: 'operation', value: ['create_profile', 'update_profile'] },
    },
    {
      id: 'firstName',
      title: 'First Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Jane',
      condition: { field: 'operation', value: ['create_profile', 'update_profile'] },
    },
    {
      id: 'lastName',
      title: 'Last Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Smith',
      condition: { field: 'operation', value: ['create_profile', 'update_profile'] },
    },
    {
      id: 'eventName',
      title: 'Event Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Placed Order, Viewed Product',
      condition: { field: 'operation', value: 'create_event' },
    },
    {
      id: 'eventProperties',
      title: 'Event Properties (JSON)',
      type: 'long-input',
      layout: 'full',
      placeholder: '{"product": "Shoes", "price": 99.99}',
      condition: { field: 'operation', value: 'create_event' },
    },
    {
      id: 'campaignId',
      title: 'Campaign ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter campaign ID',
      condition: { field: 'operation', value: 'send_campaign' },
    },
  ],
  tools: {
    access: ['klaviyo_api'],
    config: {
      tool: () => 'klaviyo_api',
      params: createParamTransformer({ eventProperties: 'json' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    profileId: { type: 'string', required: false },
    email: { type: 'string', required: false },
    firstName: { type: 'string', required: false },
    lastName: { type: 'string', required: false },
    eventName: { type: 'string', required: false },
    eventProperties: { type: 'string', required: false },
    campaignId: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
