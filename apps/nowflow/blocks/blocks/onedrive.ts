import { OneDriveIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const OneDriveBlock = defineBlock({
  type: 'onedrive',
  name: 'Microsoft OneDrive',
  description: 'List, upload, and download files via Microsoft Graph (OneDrive).',
  longDescription: 'Manage OneDrive files using Microsoft Graph API with OAuth.',
  category: 'tools',
  bgColor: '#0078D4',
  icon: OneDriveIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'microsoft-onedrive',
      serviceId: 'microsoft-onedrive',
      requiredScopes: [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/Files.ReadWrite.All',
        'https://graph.microsoft.com/Sites.ReadWrite.All',
      ],
      title: 'OneDrive Account',
      placeholder: 'Select Microsoft account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Files' },
        { id: 'upload', label: 'Upload File' },
        { id: 'download', label: 'Download File' },
      ],
    }),
    {
      id: 'driveId',
      title: 'Drive ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Optional, defaults to /me/drive',
    },
    {
      id: 'itemId',
      title: 'Item ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'For download by ID',
    },
    {
      id: 'path',
      title: 'Path',
      type: 'short-input',
      layout: 'half',
      placeholder: '/Documents/file.txt',
    },
    {
      id: 'contentType',
      title: 'Content Type',
      type: 'short-input',
      layout: 'half',
      placeholder: 'text/plain',
    },
    {
      id: 'contents',
      title: 'Contents (upload)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'File contents for upload',
    },
  ],
  tools: {
    access: ['onedrive_files'],
    config: {
      tool: () => 'onedrive_files',
      params: (params) => {
        const { credential, operation, driveId, itemId, path, contents, contentType } =
          params as Record<string, any>
        return { accessToken: credential, operation, driveId, itemId, path, contents, contentType }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    driveId: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    path: { type: 'string', required: false },
    contents: { type: 'string', required: false },
    contentType: { type: 'string', required: false },
  },
  outputs: { response: { type: { data: 'json' } } },
})
