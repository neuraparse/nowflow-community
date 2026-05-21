import { GmailIcon } from '@/components/icons'
import { GmailToolResponse } from '@/tools/gmail/types'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const GmailBlock = defineBlock<GmailToolResponse>({
  type: 'gmail',
  name: 'Gmail',
  description: 'Gmail',
  longDescription:
    'Integrate Gmail functionality into your workflow. Send, read, search, reply, forward emails, manage labels, and more using OAuth authentication.',
  category: 'tools',
  bgColor: '#E0E0E0',
  icon: GmailIcon,
  subBlocks: [
    // Operation selector
    createOperationDropdown({
      operations: [
        { id: 'send_gmail', label: 'Send Email' },
        { id: 'read_gmail', label: 'Read Emails' },
        { id: 'search_gmail', label: 'Search Emails' },
        { id: 'reply_gmail', label: 'Reply to Email' },
        { id: 'forward_gmail', label: 'Forward Email' },
        { id: 'trash_gmail', label: 'Trash/Untrash Email' },
        { id: 'list_labels_gmail', label: 'List Labels' },
        { id: 'modify_labels_gmail', label: 'Modify Labels' },
      ],
      defaultValue: 'send_gmail',
    }),
    // Gmail Credentials
    createOAuthSubBlock({
      provider: 'google-email',
      serviceId: 'gmail',
      requiredScopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
      ],
      title: 'Gmail Account',
      placeholder: 'Select Gmail account',
    }),

    // ──── SEND EMAIL ────
    {
      id: 'to',
      title: 'To',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Recipient email address',
      condition: { field: 'operation', value: 'send_gmail' },
    },
    {
      id: 'subject',
      title: 'Subject',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Email subject',
      condition: { field: 'operation', value: 'send_gmail' },
    },
    {
      id: 'body',
      title: 'Body',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Email content',
      condition: { field: 'operation', value: 'send_gmail' },
    },

    // ──── READ EMAILS ────
    {
      id: 'folder',
      title: 'Label',
      type: 'folder-selector',
      layout: 'full',
      provider: 'google-email',
      serviceId: 'gmail',
      requiredScopes: ['https://www.googleapis.com/auth/gmail.labels'],
      placeholder: 'Select Gmail label/folder',
      condition: { field: 'operation', value: 'read_gmail' },
    },
    {
      id: 'unreadOnly',
      title: 'Unread Only',
      type: 'switch',
      layout: 'full',
      condition: { field: 'operation', value: 'read_gmail' },
    },
    {
      id: 'maxResults',
      title: 'Number of Emails',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Number of emails to retrieve (default: 1, max: 10)',
      condition: { field: 'operation', value: 'read_gmail' },
    },
    {
      id: 'messageId',
      title: 'Message ID (Optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter message ID to read a specific email',
      condition: { field: 'operation', value: 'read_gmail' },
    },

    // ──── SEARCH EMAILS ────
    {
      id: 'query',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., from:user@example.com subject:invoice is:unread',
      condition: { field: 'operation', value: 'search_gmail' },
    },
    {
      id: 'searchMaxResults',
      title: 'Max Results',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Maximum number of results (default: 10)',
      condition: { field: 'operation', value: 'search_gmail' },
    },

    // ──── REPLY TO EMAIL ────
    {
      id: 'replyMessageId',
      title: 'Message ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the message to reply to',
      condition: { field: 'operation', value: 'reply_gmail' },
    },
    {
      id: 'replyBody',
      title: 'Reply Body',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Reply content',
      condition: { field: 'operation', value: 'reply_gmail' },
    },
    {
      id: 'replyAll',
      title: 'Reply All',
      type: 'switch',
      layout: 'full',
      condition: { field: 'operation', value: 'reply_gmail' },
    },

    // ──── FORWARD EMAIL ────
    {
      id: 'forwardMessageId',
      title: 'Message ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the message to forward',
      condition: { field: 'operation', value: 'forward_gmail' },
    },
    {
      id: 'forwardTo',
      title: 'Forward To',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Recipient email address',
      condition: { field: 'operation', value: 'forward_gmail' },
    },
    {
      id: 'forwardBody',
      title: 'Additional Message (Optional)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Optional message to include with forwarded email',
      condition: { field: 'operation', value: 'forward_gmail' },
    },

    // ──── TRASH/UNTRASH EMAIL ────
    {
      id: 'trashMessageId',
      title: 'Message ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the message to trash or restore',
      condition: { field: 'operation', value: 'trash_gmail' },
    },
    {
      id: 'untrash',
      title: 'Restore from Trash',
      type: 'switch',
      layout: 'full',
      condition: { field: 'operation', value: 'trash_gmail' },
    },

    // ──── LIST LABELS ────
    // No additional inputs needed

    // ──── MODIFY LABELS ────
    {
      id: 'modifyMessageId',
      title: 'Message ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the message to modify',
      condition: { field: 'operation', value: 'modify_labels_gmail' },
    },
    {
      id: 'addLabelIds',
      title: 'Add Labels',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Comma-separated label IDs (e.g., STARRED, IMPORTANT, UNREAD)',
      condition: { field: 'operation', value: 'modify_labels_gmail' },
    },
    {
      id: 'removeLabelIds',
      title: 'Remove Labels',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Comma-separated label IDs (e.g., UNREAD, INBOX)',
      condition: { field: 'operation', value: 'modify_labels_gmail' },
    },
  ],
  tools: {
    access: [
      'gmail_send',
      'gmail_read',
      'gmail_search',
      'gmail_reply',
      'gmail_forward',
      'gmail_trash',
      'gmail_list_labels',
      'gmail_modify_labels',
    ],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'send_gmail':
            return 'gmail_send'
          case 'read_gmail':
            return 'gmail_read'
          case 'search_gmail':
            return 'gmail_search'
          case 'reply_gmail':
            return 'gmail_reply'
          case 'forward_gmail':
            return 'gmail_forward'
          case 'trash_gmail':
            return 'gmail_trash'
          case 'list_labels_gmail':
            return 'gmail_list_labels'
          case 'modify_labels_gmail':
            return 'gmail_modify_labels'
          default:
            return 'gmail_send'
        }
      },
      params: (params) => {
        const { credential, operation, ...rest } = params

        switch (operation) {
          case 'send_gmail':
            return {
              credential,
              to: rest.to,
              subject: rest.subject,
              body: rest.body,
            }
          case 'read_gmail':
            return {
              credential,
              folder: rest.folder || 'INBOX',
              messageId: rest.messageId,
              unreadOnly: rest.unreadOnly,
              maxResults: rest.maxResults,
            }
          case 'search_gmail':
            return {
              credential,
              query: rest.query,
              maxResults: rest.searchMaxResults,
            }
          case 'reply_gmail':
            return {
              credential,
              messageId: rest.replyMessageId,
              body: rest.replyBody,
              replyAll: rest.replyAll,
            }
          case 'forward_gmail':
            return {
              credential,
              messageId: rest.forwardMessageId,
              to: rest.forwardTo,
              body: rest.forwardBody,
            }
          case 'trash_gmail':
            return {
              credential,
              messageId: rest.trashMessageId,
              untrash: rest.untrash,
            }
          case 'list_labels_gmail':
            return {
              credential,
            }
          case 'modify_labels_gmail':
            return {
              credential,
              messageId: rest.modifyMessageId,
              addLabelIds: rest.addLabelIds,
              removeLabelIds: rest.removeLabelIds,
            }
          default:
            return {
              credential,
              ...rest,
            }
        }
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: false },
    credential: { type: 'string', required: true },
    // Send operation inputs
    to: { type: 'string', required: false },
    subject: { type: 'string', required: false },
    body: { type: 'string', required: false },
    // Read operation inputs
    folder: { type: 'string', required: false },
    messageId: { type: 'string', required: false },
    unreadOnly: { type: 'boolean', required: false },
    maxResults: { type: 'number', required: false },
    // Search operation inputs
    query: { type: 'string', required: false },
    searchMaxResults: { type: 'number', required: false },
    // Reply operation inputs
    replyMessageId: { type: 'string', required: false },
    replyBody: { type: 'string', required: false },
    replyAll: { type: 'boolean', required: false },
    // Forward operation inputs
    forwardMessageId: { type: 'string', required: false },
    forwardTo: { type: 'string', required: false },
    forwardBody: { type: 'string', required: false },
    // Trash operation inputs
    trashMessageId: { type: 'string', required: false },
    untrash: { type: 'boolean', required: false },
    // Modify labels inputs
    modifyMessageId: { type: 'string', required: false },
    addLabelIds: { type: 'string', required: false },
    removeLabelIds: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        content: 'string',
        metadata: 'json',
      },
    },
  },
})
