import { xIcon } from '@/components/icons'
import { XReadResponse, XSearchResponse, XUserResponse, XWriteResponse } from '@/tools/x/types'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

type XResponse = XWriteResponse | XReadResponse | XSearchResponse | XUserResponse

export const XBlock = defineBlock<XResponse>({
  type: 'x',
  name: 'X',
  description: 'Interact with X',
  longDescription:
    'Connect with X to post tweets, read content, search for information, and access user profiles. Integrate social media capabilities into your workflow with comprehensive X platform access.',
  category: 'tools',
  bgColor: '#000000',
  icon: xIcon,
  subBlocks: [
    createOperationDropdown({
      operations: [
        { id: 'x_write', label: 'Post a New Tweet' },
        { id: 'x_read', label: 'Get Tweet Details' },
        { id: 'x_search', label: 'Search Tweets' },
        { id: 'x_user', label: 'Get User Profile' },
      ],
      defaultValue: 'x_write',
    }),
    createOAuthSubBlock({
      provider: 'x',
      serviceId: 'x',
      requiredScopes: ['tweet.read', 'tweet.write', 'users.read'],
      title: 'X Account',
      placeholder: 'Select X account',
    }),
    {
      id: 'text',
      title: 'Tweet Text',
      type: 'long-input',
      layout: 'full',
      placeholder: "What's happening?",
      condition: { field: 'operation', value: 'x_write' },
    },
    {
      id: 'replyTo',
      title: 'Reply To (Tweet ID)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter tweet ID to reply to',
      condition: { field: 'operation', value: 'x_write' },
    },
    {
      id: 'mediaIds',
      title: 'Media IDs',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter comma-separated media IDs',
      condition: { field: 'operation', value: 'x_write' },
    },
    {
      id: 'tweetId',
      title: 'Tweet ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter tweet ID to read',
      condition: { field: 'operation', value: 'x_read' },
    },
    {
      id: 'includeReplies',
      title: 'Include Replies',
      type: 'dropdown',
      layout: 'full',
      options: ['true', 'false'],
      value: () => 'false',
      condition: { field: 'operation', value: 'x_read' },
    },
    {
      id: 'query',
      title: 'Search Query',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter search terms (supports X search operators)',
      condition: { field: 'operation', value: 'x_search' },
    },
    {
      id: 'maxResults',
      title: 'Max Results',
      type: 'short-input',
      layout: 'full',
      placeholder: '10',
      condition: { field: 'operation', value: 'x_search' },
    },
    {
      id: 'sortOrder',
      title: 'Sort Order',
      type: 'dropdown',
      layout: 'full',
      options: ['recency', 'relevancy'],
      value: () => 'recency',
      condition: { field: 'operation', value: 'x_search' },
    },
    {
      id: 'startTime',
      title: 'Start Time',
      type: 'short-input',
      layout: 'full',
      placeholder: 'YYYY-MM-DDTHH:mm:ssZ',
      condition: { field: 'operation', value: 'x_search' },
    },
    {
      id: 'endTime',
      title: 'End Time',
      type: 'short-input',
      layout: 'full',
      placeholder: 'YYYY-MM-DDTHH:mm:ssZ',
      condition: { field: 'operation', value: 'x_search' },
    },
    {
      id: 'username',
      title: 'Username',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter username (without @)',
      condition: { field: 'operation', value: 'x_user' },
    },
  ],
  tools: {
    access: ['x_write', 'x_read', 'x_search', 'x_user'],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'x_write':
            return 'x_write'
          case 'x_read':
            return 'x_read'
          case 'x_search':
            return 'x_search'
          case 'x_user':
            return 'x_user'
          default:
            return 'x_write'
        }
      },
      params: (params) => {
        const { credential, ...rest } = params

        const parsedParams: Record<string, any> = {
          credential: credential,
        }

        Object.keys(rest).forEach((key) => {
          const value = rest[key]

          if (value === 'true' || value === 'false') {
            parsedParams[key] = value === 'true'
          } else if (key === 'maxResults' && value) {
            parsedParams[key] = parseInt(value as string, 10)
          } else if (key === 'mediaIds' && typeof value === 'string') {
            parsedParams[key] = value
              .split(',')
              .map((id) => id.trim())
              .filter((id) => id !== '')
          } else {
            parsedParams[key] = value
          }
        })

        return parsedParams
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    credential: { type: 'string', required: true },
    text: { type: 'string', required: false },
    replyTo: { type: 'string', required: false },
    mediaIds: { type: 'string', required: false },
    poll: { type: 'json', required: false },
    tweetId: { type: 'string', required: false },
    includeReplies: { type: 'boolean', required: false },
    query: { type: 'string', required: false },
    maxResults: { type: 'number', required: false },
    startTime: { type: 'string', required: false },
    endTime: { type: 'string', required: false },
    sortOrder: { type: 'string', required: false },
    username: { type: 'string', required: false },
    includeRecentTweets: { type: 'boolean', required: false },
  },
  outputs: {
    response: {
      type: {
        tweets: 'json',
        includes: 'json',
        meta: 'json',
      },
    },
  },
})
