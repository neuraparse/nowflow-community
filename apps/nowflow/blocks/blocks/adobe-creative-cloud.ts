import { AdobeIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const AdobeCreativeCloudBlock = defineBlock({
  type: 'adobe_creative_cloud',
  name: 'Adobe Creative Cloud',
  description: 'Access Adobe Creative Cloud libraries and assets',
  longDescription:
    'Integrate with Adobe Creative Cloud to manage libraries, access assets, and automate creative workflows. Work with assets from Photoshop, Illustrator, and other Adobe apps using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#FF0000',
  icon: AdobeIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'adobe',
      serviceId: 'adobe-cc',
      requiredScopes: ['openid', 'creative_sdk', 'AdobeID', 'profile', 'email'],
      title: 'Adobe Account',
      placeholder: 'Select Adobe account',
    }),
    createOperationDropdown({
      operations: [
        { id: 'list_libraries', label: 'List Libraries' },
        { id: 'get_library', label: 'Get Library' },
        { id: 'list_elements', label: 'List Library Elements' },
        { id: 'get_element', label: 'Get Element' },
        { id: 'create_element', label: 'Create Element' },
        { id: 'delete_element', label: 'Delete Element' },
      ],
      defaultValue: 'list_libraries',
    }),
    {
      id: 'libraryId',
      title: 'Library ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter library ID',
      condition: {
        field: 'operation',
        value: ['get_library', 'list_elements', 'get_element', 'create_element', 'delete_element'],
      },
    },
    {
      id: 'elementId',
      title: 'Element ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter element ID',
      condition: { field: 'operation', value: ['get_element', 'delete_element'] },
    },
    {
      id: 'elementName',
      title: 'Element Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter element name',
      condition: { field: 'operation', value: 'create_element' },
    },
    {
      id: 'elementType',
      title: 'Element Type',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'color', label: 'Color' },
        { id: 'characterstyle', label: 'Character Style' },
        { id: 'graphic', label: 'Graphic' },
        { id: 'layer_style', label: 'Layer Style' },
      ],
      value: () => 'color',
      condition: { field: 'operation', value: 'create_element' },
    },
    {
      id: 'elementData',
      title: 'Element Data (JSON)',
      type: 'code',
      layout: 'full',
      language: 'json',
      placeholder: '{"mode": "RGB", "value": {"r": 255, "g": 0, "b": 0}}',
      condition: { field: 'operation', value: 'create_element' },
    },
  ],
  tools: {
    access: ['adobe_cc_api'],
    config: {
      tool: () => 'adobe_cc_api',
      params: (params) => {
        const { credential, elementData, ...rest } = params as Record<string, any>

        const parseJSON = (value: any) => {
          if (typeof value === 'string' && value.trim()) {
            try {
              return JSON.parse(value)
            } catch {
              return undefined
            }
          }
          return value
        }

        return {
          credential,
          elementData: parseJSON(elementData),
          ...rest,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    libraryId: { type: 'string', required: false },
    elementId: { type: 'string', required: false },
    elementName: { type: 'string', required: false },
    elementType: { type: 'string', required: false },
    elementData: { type: 'json', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
