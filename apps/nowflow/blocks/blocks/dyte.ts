import { DyteIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const DyteBlock: BlockConfig = {
  type: 'dyte',
  name: 'Dyte',
  description: 'Live video SDK for embedded meetings',
  longDescription:
    'Integrate with Dyte for embedded video calls, live streaming, interactive features, and real-time collaboration using API key authentication.',
  category: 'tools',
  bgColor: '#2160FD',
  icon: DyteIcon,
  subBlocks: [
    {
      id: 'credential',
      title: 'Dyte API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your Dyte API key',
    },
    {
      id: 'orgId',
      title: 'Organization ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter your organization ID',
    },
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'create_meeting', label: 'Create Meeting' },
        { id: 'get_meeting', label: 'Get Meeting' },
        { id: 'add_participant', label: 'Add Participant' },
        { id: 'list_participants', label: 'List Participants' },
        { id: 'create_preset', label: 'Create Preset' },
        { id: 'list_presets', label: 'List Presets' },
        { id: 'start_recording', label: 'Start Recording' },
        { id: 'stop_recording', label: 'Stop Recording' },
      ],
      value: () => 'create_meeting',
    },
    {
      id: 'meetingId',
      title: 'Meeting ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter meeting ID',
      condition: {
        field: 'operation',
        value: [
          'get_meeting',
          'add_participant',
          'list_participants',
          'start_recording',
          'stop_recording',
        ],
      },
    },
    {
      id: 'title',
      title: 'Meeting Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Team Standup',
      condition: { field: 'operation', value: 'create_meeting' },
    },
    {
      id: 'participantName',
      title: 'Participant Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'John Doe',
      condition: { field: 'operation', value: 'add_participant' },
    },
  ],
  tools: {
    access: ['dyte_api'],
    config: {
      tool: () => 'dyte_api',
      params: (params) => params,
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    orgId: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    meetingId: { type: 'string', required: false },
    title: { type: 'string', required: false },
    participantName: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
}
