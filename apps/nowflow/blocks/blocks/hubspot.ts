import { HubspotIcon } from '@/components/icons'
import { createOperationDropdown, createParamTransformer, defineBlock } from '../helpers'

export const HubSpotBlock = defineBlock({
  type: 'hubspot',
  name: 'HubSpot',
  description: 'HubSpot Contacts: create/update/search via CRM v3 API.',
  longDescription:
    'Use HubSpot CRM v3 API to manage contacts. Provide API key (private app token) and fill contact fields or properties.',
  category: 'tools',
  bgColor: '#FF7A59',
  icon: HubspotIcon,
  subBlocks: [
    { id: 'apiKey', title: 'API Key', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      id: 'action',
      title: 'Action',
      operations: [
        { id: 'create', label: 'Create' },
        { id: 'update', label: 'Update' },
        { id: 'search', label: 'Search' },
        { id: 'delete', label: 'Delete' },
      ],
    }),
    { id: 'id', title: 'Contact ID (for update/delete)', type: 'short-input', layout: 'half' },
    { id: 'email', title: 'Email', type: 'short-input', layout: 'half' },
    { id: 'firstName', title: 'First Name', type: 'short-input', layout: 'half' },
    { id: 'lastName', title: 'Last Name', type: 'short-input', layout: 'half' },
    { id: 'phone', title: 'Phone', type: 'short-input', layout: 'half' },
    { id: 'company', title: 'Company', type: 'short-input', layout: 'half' },
    {
      id: 'properties',
      title: 'Properties (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
    },
    { id: 'limit', title: 'Limit', type: 'short-input', layout: 'half' },
    { id: 'after', title: 'After (cursor)', type: 'short-input', layout: 'half' },
  ],
  tools: {
    access: ['hubspot_contacts'],
    config: {
      tool: () => 'hubspot_contacts',
      params: (raw) => {
        const transformed = createParamTransformer({ properties: 'json', limit: 'number' })(raw)
        return { ...transformed, data: {} }
      },
    },
  },
  inputs: {
    apiKey: { type: 'string', required: true },
    action: { type: 'string', required: true },
    id: { type: 'string', required: false },
    email: { type: 'string', required: false },
    firstName: { type: 'string', required: false },
    lastName: { type: 'string', required: false },
    phone: { type: 'string', required: false },
    company: { type: 'string', required: false },
    properties: { type: 'string', required: false },
    limit: { type: 'string', required: false },
    after: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
