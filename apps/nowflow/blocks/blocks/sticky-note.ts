import { FileTextIcon } from '@/components/icons'
import { BlockConfig } from '../types'

export const StickyNoteBlock: BlockConfig = {
  type: 'sticky-note',
  name: 'Note',
  description: 'Add a note or comment on the canvas',
  longDescription:
    'Place a sticky note anywhere on your workflow canvas to document logic, leave reminders, or annotate complex sections. Notes are not executed — they are purely visual.',
  category: 'blocks',
  bgColor: '#F59E0B',
  icon: FileTextIcon,
  subBlocks: [
    {
      id: 'content',
      title: 'Note',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Write your note here...',
      rows: 5,
    },
    {
      id: 'color',
      title: 'Color',
      type: 'short-input',
      placeholder: 'amber',
      hidden: true,
    },
  ],
  tools: { access: [] },
  inputs: {},
  outputs: {
    response: {
      type: {
        content: 'string',
      },
    },
  },
}
