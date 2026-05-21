import { OutlookIcon } from '@/components/icons'
import { createOAuthSubBlock, defineBlock } from '../helpers'

export const OutlookBlock = defineBlock({
  type: 'outlook',
  name: 'Microsoft Outlook',
  description: 'Comprehensive Outlook email and calendar management',
  longDescription:
    'Send, read, search, reply, forward emails. Mark as read/unread, move, delete. Manage calendar events and access contacts using Microsoft Graph API with OAuth authentication.',
  category: 'tools',
  bgColor: '#0078D4',
  icon: OutlookIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'microsoft-outlook',
      serviceId: 'microsoft-outlook',
      requiredScopes: [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/Mail.ReadWrite',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Calendars.ReadWrite',
      ],
      title: 'Outlook Account',
      placeholder: 'Select Microsoft account',
    }),
    {
      id: 'category',
      title: 'Category',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'mail', label: 'Email Operations' },
        { id: 'calendar', label: 'Calendar Operations' },
      ],
      value: () => 'mail',
    },
    // Mail operations dropdown
    {
      id: 'mailOperation',
      title: 'Mail Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'send', label: 'Send Email' },
        { id: 'read', label: 'Read Emails' },
        { id: 'search', label: 'Search Emails' },
        { id: 'listFolders', label: 'List Folders' },
        { id: 'update', label: 'Update Email (Mark/Move/Delete)' },
        { id: 'reply', label: 'Reply to Email' },
        { id: 'forward', label: 'Forward Email' },
      ],
      value: () => 'send',
      condition: { field: 'category', value: 'mail' },
    },
    // Calendar operations dropdown
    {
      id: 'calendarOperation',
      title: 'Calendar Operation',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'list', label: 'List Events' },
        { id: 'get', label: 'Get Event' },
        { id: 'create', label: 'Create Event' },
        { id: 'update', label: 'Update Event' },
      ],
      value: () => 'list',
      condition: { field: 'category', value: 'calendar' },
    },

    // ===== MAIL SEND =====
    {
      id: 'to',
      title: 'To (Email Address)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'recipient@example.com (comma-separated for multiple)',
      condition: { field: 'mailOperation', value: 'send' },
    },
    {
      id: 'subject',
      title: 'Subject',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Email subject',
      condition: { field: 'mailOperation', value: 'send' },
    },
    {
      id: 'body',
      title: 'Email Body',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Email content (supports HTML)',
      condition: { field: 'mailOperation', value: 'send' },
    },
    {
      id: 'contentType',
      title: 'Content Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'HTML', label: 'HTML' },
        { id: 'Text', label: 'Plain Text' },
      ],
      value: () => 'HTML',
      condition: { field: 'mailOperation', value: 'send' },
    },

    // ===== MAIL READ =====
    {
      id: 'folderId',
      title: 'Folder',
      type: 'short-input',
      layout: 'half',
      placeholder: 'inbox, sentitems, drafts',
      condition: { field: 'mailOperation', value: 'read' },
    },
    {
      id: 'top',
      title: 'Max Results',
      type: 'short-input',
      layout: 'half',
      placeholder: '10 (max 50)',
      condition: { field: 'mailOperation', value: 'read' },
    },
    {
      id: 'unreadOnly',
      title: 'Unread Only',
      type: 'switch',
      layout: 'full',
      condition: { field: 'mailOperation', value: 'read' },
    },
    {
      id: 'messageId',
      title: 'Specific Message ID (optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Leave empty to get recent messages',
      condition: { field: 'mailOperation', value: 'read' },
    },

    // ===== MAIL SEARCH =====
    {
      id: 'searchQuery',
      title: 'Search Query',
      type: 'short-input',
      layout: 'full',
      placeholder: 'from:sender@example.com subject:important',
      condition: { field: 'mailOperation', value: 'search' },
    },
    {
      id: 'folder',
      title: 'Folder (optional)',
      type: 'short-input',
      layout: 'half',
      placeholder: 'inbox (leave empty for all)',
      condition: { field: 'mailOperation', value: 'search' },
    },
    {
      id: 'searchTop',
      title: 'Max Results',
      type: 'short-input',
      layout: 'half',
      placeholder: '10 (max 50)',
      condition: { field: 'mailOperation', value: 'search' },
    },

    // ===== MAIL LIST FOLDERS =====
    {
      id: 'includeHidden',
      title: 'Include Hidden Folders',
      type: 'switch',
      layout: 'full',
      condition: { field: 'mailOperation', value: 'listFolders' },
    },

    // ===== MAIL UPDATE =====
    {
      id: 'updateMessageId',
      title: 'Message ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the email to update',
      condition: { field: 'mailOperation', value: 'update' },
    },
    {
      id: 'updateOperation',
      title: 'Update Action',
      type: 'dropdown',
      layout: 'full',
      options: [
        { id: 'markRead', label: 'Mark as Read' },
        { id: 'markUnread', label: 'Mark as Unread' },
        { id: 'move', label: 'Move to Folder' },
        { id: 'delete', label: 'Delete' },
      ],
      value: () => 'markRead',
      condition: { field: 'mailOperation', value: 'update' },
    },
    {
      id: 'destinationFolderId',
      title: 'Destination Folder ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'e.g., inbox, archive, deleteditems',
      condition: { field: 'updateOperation', value: 'move' },
    },

    // ===== MAIL REPLY =====
    {
      id: 'replyMessageId',
      title: 'Message ID to Reply',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the email to reply to',
      condition: { field: 'mailOperation', value: 'reply' },
    },
    {
      id: 'replyBody',
      title: 'Reply Body',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Your reply message',
      condition: { field: 'mailOperation', value: 'reply' },
    },
    {
      id: 'replyAll',
      title: 'Reply All',
      type: 'switch',
      layout: 'full',
      condition: { field: 'mailOperation', value: 'reply' },
    },
    {
      id: 'replyContentType',
      title: 'Content Type',
      type: 'dropdown',
      layout: 'half',
      options: [
        { id: 'HTML', label: 'HTML' },
        { id: 'Text', label: 'Plain Text' },
      ],
      value: () => 'HTML',
      condition: { field: 'mailOperation', value: 'reply' },
    },

    // ===== MAIL FORWARD =====
    {
      id: 'forwardMessageId',
      title: 'Message ID to Forward',
      type: 'short-input',
      layout: 'full',
      placeholder: 'ID of the email to forward',
      condition: { field: 'mailOperation', value: 'forward' },
    },
    {
      id: 'forwardTo',
      title: 'Forward To',
      type: 'short-input',
      layout: 'full',
      placeholder: 'recipient@example.com (comma-separated for multiple)',
      condition: { field: 'mailOperation', value: 'forward' },
    },
    {
      id: 'forwardComment',
      title: 'Comment (optional)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Optional comment to add when forwarding',
      condition: { field: 'mailOperation', value: 'forward' },
    },

    // ===== CALENDAR INPUTS =====
    {
      id: 'calendarId',
      title: 'Calendar ID (optional)',
      type: 'short-input',
      layout: 'full',
      condition: { field: 'category', value: 'calendar' },
    },
    {
      id: 'eventId',
      title: 'Event ID',
      type: 'short-input',
      layout: 'half',
      condition: { field: 'category', value: 'calendar' },
    },
    {
      id: 'timeMin',
      title: 'Time Min (ISO)',
      type: 'short-input',
      layout: 'half',
      condition: { field: 'category', value: 'calendar' },
    },
    {
      id: 'timeMax',
      title: 'Time Max (ISO)',
      type: 'short-input',
      layout: 'half',
      condition: { field: 'category', value: 'calendar' },
    },
    {
      id: 'data',
      title: 'Event JSON',
      type: 'long-input',
      layout: 'full',
      condition: { field: 'category', value: 'calendar' },
    },
  ],
  tools: {
    access: [
      'outlook_mail_send',
      'outlook_mail_read',
      'outlook_mail_search',
      'outlook_mail_list_folders',
      'outlook_mail_update',
      'outlook_mail_reply',
      'outlook_mail_forward',
      'outlook_calendar_events',
    ],
    config: {
      tool: (params) => {
        const { category, mailOperation } = params as Record<string, any>
        if (category === 'mail') {
          switch (mailOperation) {
            case 'send':
              return 'outlook_mail_send'
            case 'read':
              return 'outlook_mail_read'
            case 'search':
              return 'outlook_mail_search'
            case 'listFolders':
              return 'outlook_mail_list_folders'
            case 'update':
              return 'outlook_mail_update'
            case 'reply':
              return 'outlook_mail_reply'
            case 'forward':
              return 'outlook_mail_forward'
            default:
              return 'outlook_mail_send'
          }
        } else {
          // Calendar operations
          return 'outlook_calendar_events'
        }
      },
      params: (params) => {
        const { credential, category, mailOperation, calendarOperation, ...rest } =
          params as Record<string, any>

        if (category === 'mail') {
          switch (mailOperation) {
            case 'send':
              return {
                credential,
                category,
                mailOperation,
                to: rest.to,
                subject: rest.subject,
                body: rest.body,
                contentType: rest.contentType,
              }
            case 'read':
              return {
                credential,
                category,
                mailOperation,
                messageId: rest.messageId,
                folderId: rest.folderId,
                top: rest.top,
                unreadOnly: rest.unreadOnly,
              }
            case 'search':
              return {
                credential,
                category,
                mailOperation,
                searchQuery: rest.searchQuery,
                folder: rest.folder,
                top: rest.searchTop,
              }
            case 'listFolders':
              return {
                credential,
                category,
                mailOperation,
                includeHidden: rest.includeHidden,
              }
            case 'update':
              return {
                credential,
                category,
                mailOperation,
                messageId: rest.updateMessageId,
                operation: rest.updateOperation,
                destinationFolderId: rest.destinationFolderId,
              }
            case 'reply':
              return {
                credential,
                category,
                mailOperation,
                messageId: rest.replyMessageId,
                body: rest.replyBody,
                contentType: rest.replyContentType,
                replyAll: rest.replyAll,
              }
            case 'forward':
              return {
                credential,
                category,
                mailOperation,
                messageId: rest.forwardMessageId,
                to: rest.forwardTo,
                comment: rest.forwardComment,
              }
            default:
              return { credential, category, mailOperation, ...rest }
          }
        } else {
          // Calendar operations
          return {
            credential,
            category,
            calendarOperation,
            operation: calendarOperation,
            eventId: rest.eventId,
            calendarId: rest.calendarId,
            timeMin: rest.timeMin,
            timeMax: rest.timeMax,
            data: typeof rest.data === 'string' ? safeParseJson(rest.data) : rest.data,
          }
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    category: { type: 'string', required: true },
    mailOperation: { type: 'string', required: false },
    calendarOperation: { type: 'string', required: false },
    // Mail send
    to: { type: 'string', required: false },
    subject: { type: 'string', required: false },
    body: { type: 'string', required: false },
    contentType: { type: 'string', required: false },
    // Mail read
    messageId: { type: 'string', required: false },
    folderId: { type: 'string', required: false },
    top: { type: 'string', required: false },
    unreadOnly: { type: 'boolean', required: false },
    // Mail search
    searchQuery: { type: 'string', required: false },
    folder: { type: 'string', required: false },
    searchTop: { type: 'string', required: false },
    // Mail list folders
    includeHidden: { type: 'boolean', required: false },
    // Mail update
    updateMessageId: { type: 'string', required: false },
    updateOperation: { type: 'string', required: false },
    destinationFolderId: { type: 'string', required: false },
    // Mail reply
    replyMessageId: { type: 'string', required: false },
    replyBody: { type: 'string', required: false },
    replyAll: { type: 'boolean', required: false },
    replyContentType: { type: 'string', required: false },
    // Mail forward
    forwardMessageId: { type: 'string', required: false },
    forwardTo: { type: 'string', required: false },
    forwardComment: { type: 'string', required: false },
    // Calendar
    calendarId: { type: 'string', required: false },
    eventId: { type: 'string', required: false },
    timeMin: { type: 'string', required: false },
    timeMax: { type: 'string', required: false },
    data: { type: 'json', required: false },
  },
  outputs: { response: { type: { data: 'json' } } },
})

function safeParseJson(s?: string) {
  if (!s) return undefined
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}
