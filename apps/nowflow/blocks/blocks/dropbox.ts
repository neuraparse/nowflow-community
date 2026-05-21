import { DropboxIcon } from '@/components/icons'
import { createOperationDropdown, defineBlock } from '../helpers'

export const DropboxBlock = defineBlock({
  type: 'dropbox',
  name: 'Dropbox',
  description: 'Dropbox files: list or upload.',
  longDescription: 'Use Dropbox API to list folder contents or upload a text file.',
  category: 'tools',
  bgColor: '#0061FF',
  icon: DropboxIcon,
  subBlocks: [
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Folder' },
        { id: 'upload', label: 'Upload File' },
      ],
    }),
    { id: 'path', title: 'Path', type: 'short-input', layout: 'full', placeholder: '/myfolder' },
    {
      id: 'contents',
      title: 'Contents (text)',
      type: 'code',
      layout: 'full',
      language: 'text',
      placeholder: 'Hello from NowFlow!',
    },
  ],
  tools: {
    access: ['dropbox_files'],
    config: {
      tool: () => 'dropbox_files',
      params: (params) => {
        const { token, operation, path, contents } = params as Record<string, any>
        return { token, operation, path, contents }
      },
    },
  },
  inputs: {
    token: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    path: { type: 'string', required: false },
    contents: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
