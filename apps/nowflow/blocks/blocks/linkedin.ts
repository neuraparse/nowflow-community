import { LinkedInIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const LinkedInBlock = defineBlock({
  type: 'linkedin',
  name: 'LinkedIn',
  description: 'Share content on LinkedIn',
  longDescription:
    'Connect with LinkedIn to share posts, articles, and updates with your professional network. Build your personal brand and engage with your connections through automated LinkedIn posting.',
  category: 'tools',
  bgColor: '#0A66C2',
  icon: LinkedInIcon,
  subBlocks: [
    createOperationDropdown({
      operations: [
        { id: 'linkedin_share', label: 'Share a Post' },
        { id: 'linkedin_profile', label: 'Get Profile Info' },
        { id: 'linkedin_get_post_details', label: 'Get Post Details (Requires Partner API)' },
        { id: 'linkedin_add_comment', label: 'Add Comment to Post (Requires Partner API)' },
        { id: 'linkedin_add_reaction', label: 'Add Reaction to Post (Requires Partner API)' },
      ],
      defaultValue: 'linkedin_share',
    }),
    createOAuthSubBlock({
      provider: 'linkedin',
      serviceId: 'linkedin',
      requiredScopes: ['openid', 'profile', 'email', 'w_member_social'],
      title: 'LinkedIn Account',
      placeholder: 'Select LinkedIn account',
    }),
    {
      id: 'text',
      title: 'Post Text',
      type: 'long-input',
      layout: 'full',
      placeholder: 'What do you want to share with your network?',
      condition: { field: 'operation', value: 'linkedin_share' },
    },
    {
      id: 'visibility',
      title: 'Post Visibility',
      type: 'dropdown',
      layout: 'full',
      options: [
        { label: 'Public', id: 'PUBLIC' },
        { label: 'Connections Only', id: 'CONNECTIONS' },
      ],
      value: () => 'PUBLIC',
      condition: { field: 'operation', value: 'linkedin_share' },
    },
    {
      id: 'postUrn',
      title: 'Post URL or URN',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Paste LinkedIn post URL or URN (e.g., https://linkedin.com/feed/update/...)',
      condition: { field: 'operation', value: 'linkedin_get_post_details' },
    },
    {
      id: 'postUrn',
      title: 'Post URL or URN',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Paste LinkedIn post URL or URN (e.g., https://linkedin.com/feed/update/...)',
      condition: { field: 'operation', value: 'linkedin_add_comment' },
    },
    {
      id: 'commentText',
      title: 'Comment Text',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Your comment...',
      condition: { field: 'operation', value: 'linkedin_add_comment' },
    },
    {
      id: 'postUrn',
      title: 'Post URL or URN',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Paste LinkedIn post URL or URN (e.g., https://linkedin.com/feed/update/...)',
      condition: { field: 'operation', value: 'linkedin_add_reaction' },
    },
    {
      id: 'reactionType',
      title: 'Reaction Type',
      type: 'dropdown',
      layout: 'full',
      options: [
        { label: '👍 Like', id: 'LIKE' },
        { label: '🎉 Celebrate (Praise)', id: 'PRAISE' },
        { label: '❤️ Support (Appreciation)', id: 'APPRECIATION' },
        { label: '💡 Insightful (Interest)', id: 'INTEREST' },
        { label: '😍 Love (Empathy)', id: 'EMPATHY' },
        { label: '🤔 Curious (Entertainment)', id: 'ENTERTAINMENT' },
      ],
      value: () => 'LIKE',
      condition: { field: 'operation', value: 'linkedin_add_reaction' },
    },
  ],
  tools: {
    access: [
      'linkedin_share',
      'linkedin_profile',
      'linkedin_get_post_details',
      'linkedin_add_comment',
      'linkedin_add_reaction',
    ],
    config: {
      tool: (params) => {
        switch (params.operation) {
          case 'linkedin_share':
            return 'linkedin_share'
          case 'linkedin_profile':
            return 'linkedin_profile'
          case 'linkedin_get_post_details':
            return 'linkedin_get_post_details'
          case 'linkedin_add_comment':
            return 'linkedin_add_comment'
          case 'linkedin_add_reaction':
            return 'linkedin_add_reaction'
          default:
            return 'linkedin_share'
        }
      },
      params: (params) => {
        const { credential, commentText, ...rest } = params

        const mappedParams: Record<string, any> = {
          credential,
          ...rest,
        }

        if (params.operation === 'linkedin_add_comment' && commentText) {
          mappedParams.text = commentText
        }

        return mappedParams
      },
    },
  },
  inputs: {
    operation: { type: 'string', required: true },
    credential: { type: 'string', required: true },
    text: { type: 'string', required: false },
    visibility: { type: 'string', required: false },
    postUrn: { type: 'string', required: false },
    commentText: { type: 'string', required: false },
    reactionType: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: 'json',
    },
  },
})
