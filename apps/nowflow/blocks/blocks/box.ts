import { BoxIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const BoxBlock = defineBlock({
  type: 'box',
  name: 'Box',
  description: 'List, upload, and download files from Box.',
  longDescription: 'Manage files and folders on Box using API tokens or OAuth access tokens.',
  category: 'tools',
  bgColor: '#0061D5',
  icon: BoxIcon,
  subBlocks: [
    { id: 'apiToken', title: 'API Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Folder' },
        { id: 'download', label: 'Download File' },
        { id: 'upload', label: 'Upload File' },
      ],
    }),
    {
      id: 'folderId',
      title: 'Folder ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Default root: 0',
    },
    { id: 'fileId', title: 'File ID', type: 'short-input', layout: 'half' },
    { id: 'path', title: 'Path / File Name', type: 'short-input', layout: 'half' },
    { id: 'contentType', title: 'Content Type', type: 'short-input', layout: 'half' },
    { id: 'contents', title: 'Contents (upload)', type: 'long-input', layout: 'full' },
  ],
  tools: {
    access: ['box_files'],
    config: {
      tool: () => 'box_files',
      params: (params) => {
        const { apiToken, operation, folderId, fileId, path, contents, contentType } =
          params as Record<string, any>
        return { apiToken, operation, folderId, fileId, path, contents, contentType }
      },
    },
  },
  inputs: {
    apiToken: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    folderId: { type: 'string', required: false },
    fileId: { type: 'string', required: false },
    path: { type: 'string', required: false },
    contents: { type: 'string', required: false },
    contentType: { type: 'string', required: false },
  },
  outputs: { response: { type: { data: 'json' } } },
})
