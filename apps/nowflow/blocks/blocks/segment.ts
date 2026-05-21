import { SegmentIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createSimpleToolConfig,
  defineBlock,
} from '../helpers'

export const SegmentBlock = defineBlock({
  type: 'segment',
  name: 'Segment',
  description: 'Customer data platform for collecting, cleaning, and controlling customer data.',
  longDescription:
    'Integrate with Segment to collect customer data from every source, clean and unify it, and sync it to marketing and analytics tools. Segment is the leading customer data platform (CDP) used by thousands of businesses to make real-time decisions, accelerate growth, and deliver personalized experiences.',
  category: 'tools',
  bgColor: '#52BD95',
  icon: SegmentIcon,
  subBlocks: [
    createOAuthSubBlock({
      title: 'Segment Account',
      provider: 'segment',
      serviceId: 'segment',
      requiredScopes: [],
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_sources', label: 'List Sources' },
        { id: 'create_source', label: 'Create Source' },
        { id: 'get_source', label: 'Get Source' },
        { id: 'list_destinations', label: 'List Destinations' },
        { id: 'create_destination', label: 'Create Destination' },
        { id: 'get_destination', label: 'Get Destination' },
        { id: 'track_event', label: 'Track Event' },
        { id: 'identify_user', label: 'Identify User' },
      ],
      defaultValue: 'track_event',
    }),
    {
      id: 'sourceId',
      title: 'Source ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter source ID',
      condition: { field: 'operation', value: ['get_source', 'track_event'] },
    },
    {
      id: 'destinationId',
      title: 'Destination ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter destination ID',
      condition: { field: 'operation', value: 'get_destination' },
    },
    {
      id: 'event',
      title: 'Event Name',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Button Clicked',
      condition: { field: 'operation', value: 'track_event' },
    },
    {
      id: 'userId',
      title: 'User ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'user123',
      condition: { field: 'operation', value: ['track_event', 'identify_user'] },
    },
    {
      id: 'properties',
      title: 'Properties (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"plan": "premium", "revenue": 99.99}',
      condition: { field: 'operation', value: ['track_event', 'identify_user'] },
    },
    {
      id: 'sourceName',
      title: 'Source Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Source',
      condition: { field: 'operation', value: 'create_source' },
    },
    {
      id: 'destinationName',
      title: 'Destination Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Destination',
      condition: { field: 'operation', value: 'create_destination' },
    },
  ],
  tools: {
    access: ['segment_api'],
    config: createSimpleToolConfig('segment_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    sourceId: { type: 'string', required: false },
    destinationId: { type: 'string', required: false },
    event: { type: 'string', required: false },
    userId: { type: 'string', required: false },
    properties: { type: 'json', required: false },
    sourceName: { type: 'string', required: false },
    destinationName: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
