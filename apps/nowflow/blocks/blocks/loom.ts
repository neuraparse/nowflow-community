import { LoomIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const LoomBlock = defineBlock({
  type: 'loom',
  name: 'Loom',
  description: 'Record and share video messages with Loom',
  longDescription:
    'Integrate with Loom to manage video recordings, share videos, get video analytics, and automate video workflows. Perfect for async communication and video documentation using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#625DF5',
  icon: LoomIcon,
  subBlocks: [
    createOAuthSubBlock({
      title: 'Loom Account',
      provider: 'loom',
      serviceId: 'loom',
      requiredScopes: ['video:read', 'video:write'],
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_videos', label: 'List Videos' },
        { id: 'get_video', label: 'Get Video' },
        { id: 'update_video', label: 'Update Video' },
        { id: 'delete_video', label: 'Delete Video' },
        { id: 'get_video_insights', label: 'Get Video Insights' },
        { id: 'create_folder', label: 'Create Folder' },
        { id: 'list_folders', label: 'List Folders' },
        { id: 'get_user', label: 'Get User Info' },
      ],
      defaultValue: 'list_videos',
    }),
    {
      id: 'videoId',
      title: 'Video ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter video ID',
      condition: {
        field: 'operation',
        value: ['get_video', 'update_video', 'delete_video', 'get_video_insights'],
      },
    },
    {
      id: 'videoTitle',
      title: 'Video Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Video Title',
      condition: { field: 'operation', value: 'update_video' },
    },
    {
      id: 'videoDescription',
      title: 'Video Description',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Video description',
      condition: { field: 'operation', value: 'update_video' },
    },
    {
      id: 'folderId',
      title: 'Folder ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter folder ID',
      condition: { field: 'operation', value: 'update_video' },
    },
    {
      id: 'folderName',
      title: 'Folder Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Folder',
      condition: { field: 'operation', value: 'create_folder' },
    },
    {
      id: 'limit',
      title: 'Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '20',
      condition: { field: 'operation', value: ['list_videos', 'list_folders'] },
    },
  ],
  tools: {
    access: ['loom_api'],
    config: {
      tool: () => 'loom_api',
      params: createParamTransformer({ limit: 'number' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    videoId: { type: 'string', required: false },
    videoTitle: { type: 'string', required: false },
    videoDescription: { type: 'string', required: false },
    folderId: { type: 'string', required: false },
    folderName: { type: 'string', required: false },
    limit: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
