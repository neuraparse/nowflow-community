import { MiroIcon } from '@/components/icons'
import {
  createOAuthSubBlock,
  createOperationDropdown,
  createParamTransformer,
  defineBlock,
} from '../helpers'

export const MiroBlock = defineBlock({
  type: 'miro',
  name: 'Miro',
  description: 'Create and manage visual collaboration boards',
  longDescription:
    'Integrate with Miro to create boards, add sticky notes, shapes, and widgets, manage team collaboration, and automate visual workflows. Perfect for remote teams and agile workflows using OAuth 2.0 authentication.',
  category: 'tools',
  bgColor: '#FFD02F',
  icon: MiroIcon,
  subBlocks: [
    createOAuthSubBlock({
      title: 'Miro Account',
      provider: 'miro',
      serviceId: 'miro',
      requiredScopes: ['boards:read', 'boards:write'],
    }),
    createOperationDropdown({
      operations: [
        { id: 'create_board', label: 'Create Board' },
        { id: 'get_board', label: 'Get Board' },
        { id: 'list_boards', label: 'List Boards' },
        { id: 'create_sticky_note', label: 'Create Sticky Note' },
        { id: 'create_shape', label: 'Create Shape' },
        { id: 'create_text', label: 'Create Text' },
        { id: 'list_items', label: 'List Board Items' },
        { id: 'get_item', label: 'Get Item' },
        { id: 'delete_item', label: 'Delete Item' },
      ],
      defaultValue: 'list_boards',
    }),
    {
      id: 'boardId',
      title: 'Board ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter board ID',
      condition: {
        field: 'operation',
        value: [
          'get_board',
          'create_sticky_note',
          'create_shape',
          'create_text',
          'list_items',
          'get_item',
          'delete_item',
        ],
      },
    },
    {
      id: 'boardName',
      title: 'Board Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'My Collaboration Board',
      condition: { field: 'operation', value: 'create_board' },
    },
    {
      id: 'itemId',
      title: 'Item ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter item ID',
      condition: { field: 'operation', value: ['get_item', 'delete_item'] },
    },
    {
      id: 'content',
      title: 'Content',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Sticky note text or content',
      condition: { field: 'operation', value: ['create_sticky_note', 'create_text'] },
    },
    {
      id: 'shape',
      title: 'Shape Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'rectangle', label: 'Rectangle' },
        { id: 'circle', label: 'Circle' },
        { id: 'triangle', label: 'Triangle' },
        { id: 'rhombus', label: 'Rhombus' },
      ],
      value: () => 'rectangle',
      condition: { field: 'operation', value: 'create_shape' },
    },
    {
      id: 'x',
      title: 'X Position',
      type: 'short-input',
      layout: 'half',
      placeholder: '0',
      condition: {
        field: 'operation',
        value: ['create_sticky_note', 'create_shape', 'create_text'],
      },
    },
    {
      id: 'y',
      title: 'Y Position',
      type: 'short-input',
      layout: 'half',
      placeholder: '0',
      condition: {
        field: 'operation',
        value: ['create_sticky_note', 'create_shape', 'create_text'],
      },
    },
  ],
  tools: {
    access: ['miro_api'],
    config: {
      tool: () => 'miro_api',
      params: createParamTransformer({ x: 'number', y: 'number' }),
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    operation: { type: 'string', required: true },
    boardId: { type: 'string', required: false },
    boardName: { type: 'string', required: false },
    itemId: { type: 'string', required: false },
    content: { type: 'string', required: false },
    shape: { type: 'string', required: false },
    x: { type: 'string', required: false },
    y: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        data: 'json',
      },
    },
  },
})
