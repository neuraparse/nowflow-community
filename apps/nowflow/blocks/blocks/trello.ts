import { TrelloIcon } from '@/components/icons'
import { createOperationDropdown, createSimpleToolConfig, defineBlock } from '../helpers'

export const TrelloBlock = defineBlock({
  type: 'trello',
  name: 'Trello',
  description: 'Trello Cards operations: list, get, create, update.',
  longDescription:
    'Use Trello API with key and token to list cards on a board, retrieve a card, create a new card, or update an existing card.',
  category: 'tools',
  bgColor: '#0079BF',
  icon: TrelloIcon,
  subBlocks: [
    { id: 'key', title: 'API Key', type: 'short-input', layout: 'full', password: true },
    { id: 'token', title: 'Token', type: 'short-input', layout: 'full', password: true },
    { id: 'boardId', title: 'Board ID', type: 'short-input', layout: 'half' },
    { id: 'listId', title: 'List ID', type: 'short-input', layout: 'half' },
    { id: 'cardId', title: 'Card ID', type: 'short-input', layout: 'half' },
    createOperationDropdown({
      operations: [
        { id: 'list', label: 'List Cards' },
        { id: 'get', label: 'Get Card' },
        { id: 'create', label: 'Create Card' },
        { id: 'update', label: 'Update Card' },
      ],
    }),
    { id: 'name', title: 'Name', type: 'short-input', layout: 'full' },
    { id: 'desc', title: 'Description', type: 'short-input', layout: 'full' },
    { id: 'due', title: 'Due (ISO)', type: 'short-input', layout: 'half' },
  ],
  tools: {
    access: ['trello_cards'],
    config: createSimpleToolConfig('trello_cards'),
  },
  inputs: {
    key: { type: 'string', required: true },
    token: { type: 'string', required: true },
    boardId: { type: 'string', required: false },
    listId: { type: 'string', required: false },
    cardId: { type: 'string', required: false },
    operation: { type: 'string', required: true },
    name: { type: 'string', required: false },
    desc: { type: 'string', required: false },
    due: { type: 'string', required: false },
  },
  outputs: {
    response: { type: 'json' },
  },
})
