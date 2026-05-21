import { ZoomIcon } from '@/components/icons'
import { createParamTransformer } from '../helpers'
import { BlockConfig } from '../types'

export const ZoomBlock: BlockConfig = {
  type: 'zoom',
  name: 'Zoom',
  description: 'Manage Zoom meetings: list, get, create, update.',
  longDescription: 'Zoom Meetings API using JWT/OAuth bearer token.',
  category: 'tools',
  bgColor: '#2D8CFF',
  icon: ZoomIcon,
  subBlocks: [
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'list', label: 'List Meetings' },
        { id: 'get', label: 'Get Meeting' },
        { id: 'create', label: 'Create Meeting' },
        { id: 'update', label: 'Update Meeting' },
      ],
    },
    {
      id: 'meetingId',
      title: 'Meeting ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'For get/update',
    },
    {
      id: 'type',
      title: 'List Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'live', label: 'Live' },
        { id: 'scheduled', label: 'Scheduled' },
      ],
    },
    { id: 'data', title: 'Payload (JSON)', type: 'code', layout: 'full', language: 'json' },
  ],
  tools: {
    access: ['zoom_meetings'],
    config: {
      tool: () => 'zoom_meetings',
      params: createParamTransformer({
        data: 'json',
      }),
    },
  },
  inputs: {
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    meetingId: { type: 'string', required: false },
    type: { type: 'string', required: false },
    data: { type: 'string', required: false },
  },
  outputs: { response: { type: { data: 'json' } } },
}
