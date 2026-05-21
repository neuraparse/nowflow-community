import { WherebyIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const WherebyBlock: BlockConfig = {
  type: 'whereby',
  name: 'Whereby',
  description: 'Simple embedded video meetings',
  longDescription:
    'Integrate with Whereby to embed video meetings into your app without external links. Easy-to-use video conferencing with up to 50 participants, perfect for small to medium-sized meetings with API key authentication.',
  category: 'tools',
  bgColor: '#1E4EDD',
  icon: WherebyIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Whereby API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Whereby API key',
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'create_meeting', label: 'Create Meeting' },
        { id: 'get_meeting', label: 'Get Meeting' },
        { id: 'delete_meeting', label: 'Delete Meeting' },
        { id: 'list_meetings', label: 'List Meetings' },
      ],
      value: () => 'create_meeting',
    },
    {
      id: 'roomName',
      title: 'Room Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'my-meeting-room',
      condition: { field: 'operation', value: 'create_meeting' },
    },
    {
      id: 'meetingId',
      title: 'Meeting ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter meeting ID',
      condition: { field: 'operation', value: ['get_meeting', 'delete_meeting'] },
    },
    {
      id: 'startDate',
      title: 'Start Date (ISO 8601)',
      type: 'short-input',
      layout: 'half',
      placeholder: '2025-01-15T10:00:00Z',
      condition: { field: 'operation', value: 'create_meeting' },
    },
    {
      id: 'endDate',
      title: 'End Date (ISO 8601)',
      type: 'short-input',
      layout: 'half',
      placeholder: '2025-01-15T11:00:00Z',
      condition: { field: 'operation', value: 'create_meeting' },
    },
  ],
  tools: {
    access: ['whereby_api'],
    config: {
      tool: () => 'whereby_api',
      params: (params) => params,
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    roomName: { type: 'string', required: false },
    meetingId: { type: 'string', required: false },
    startDate: { type: 'string', required: false },
    endDate: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
}
