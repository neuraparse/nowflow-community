import { CanvaIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createSimpleToolConfig,
  defineBlock,
} from '../helpers'

export const CanvaBlock = defineBlock({
  type: 'canva',
  name: 'Canva',
  description: 'Create and manage Canva designs',
  longDescription:
    'Integrate with Canva Connect APIs to create designs, manage assets, export designs, and automate your design workflows with OAuth authentication.',
  category: 'tools',
  bgColor: '#00C4CC',
  icon: CanvaIcon,
  subBlocks: [
    createOAuthSubBlock({
      title: 'Canva Account',
      provider: 'canva',
      serviceId: 'canva',
      requiredScopes: ['design:content:read', 'design:content:write', 'asset:read', 'asset:write'],
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_design', label: 'Create Design' },
        { id: 'get_design', label: 'Get Design' },
        { id: 'export_design', label: 'Export Design' },
        { id: 'upload_asset', label: 'Upload Asset' },
        { id: 'list_folders', label: 'List Folders' },
      ],
      defaultValue: 'create_design',
    }),
    {
      id: 'designType',
      title: 'Design Type',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'DOC', label: 'Document' },
        { id: 'INSTAGRAM_STORY', label: 'Instagram Story' },
        { id: 'INSTAGRAM_POST', label: 'Instagram Post' },
        { id: 'FACEBOOK_POST', label: 'Facebook Post' },
        { id: 'PRESENTATION', label: 'Presentation' },
        { id: 'LOGO', label: 'Logo' },
        { id: 'POSTER', label: 'Poster' },
      ],
      value: () => 'DOC',
      condition: { field: 'operation', value: 'create_design' },
    },
    {
      id: 'title',
      title: 'Design Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter design title',
      condition: { field: 'operation', value: 'create_design' },
    },
    {
      id: 'designId',
      title: 'Design ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter design ID',
      condition: { field: 'operation', value: ['get_design', 'export_design'] },
    },
    {
      id: 'exportFormat',
      title: 'Export Format',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'png', label: 'PNG' },
        { id: 'jpg', label: 'JPG' },
        { id: 'pdf', label: 'PDF' },
      ],
      value: () => 'png',
      condition: { field: 'operation', value: 'export_design' },
    },
    {
      id: 'assetUrl',
      title: 'Asset URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter URL of asset to upload',
      condition: { field: 'operation', value: 'upload_asset' },
    },
  ],
  tools: {
    access: ['canva_api'],
    config: createSimpleToolConfig('canva_api'),
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    designType: { type: 'string', required: false },
    title: { type: 'string', required: false },
    designId: { type: 'string', required: false },
    exportFormat: { type: 'string', required: false },
    assetUrl: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
