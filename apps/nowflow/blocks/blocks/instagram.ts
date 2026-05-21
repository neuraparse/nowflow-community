import { InstagramIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const InstagramBlock = defineBlock({
  type: 'instagram',
  name: 'Instagram',
  description: 'Instagram Graph API operations (publish media).',
  longDescription: 'Publish media to Instagram Business accounts via the Instagram Graph API.',
  category: 'tools',
  bgColor: '#E1306C',
  icon: InstagramIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'meta-instagram',
      serviceId: 'meta-instagram',
      requiredScopes: [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'business_management',
      ],
      title: 'Instagram Account',
      placeholder: 'Select Meta account for Instagram',
    }),
    createOperationDropdown({
      id: 'action',
      title: 'Action',
      operations: [
        { id: 'list_accounts', label: 'List Business Accounts' },
        { id: 'post_media', label: 'Post Media' },
      ],
    }),
    {
      id: 'pageId',
      title: 'Facebook Page ID (Optional)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Used for listing the Instagram Business account for a specific page',
      condition: { field: 'action', value: 'list_accounts' },
    },
    {
      id: 'igUserId',
      title: 'Instagram Business Account ID (ig-user ID)',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Instagram Business (ig-user) ID',
      condition: { field: 'action', value: 'post_media' },
    },
    {
      id: 'caption',
      title: 'Caption',
      type: 'long-input',
      layout: 'full',
      condition: { field: 'action', value: 'post_media' },
    },
    {
      id: 'mediaUrl',
      title: 'Media URL',
      type: 'short-input',
      layout: 'full',
      condition: { field: 'action', value: 'post_media' },
    },
  ],
  tools: {
    access: ['instagram_post_media', 'instagram_list_accounts'],
    config: {
      tool: (params) => {
        switch (params.action) {
          case 'list_accounts':
            return 'instagram_list_accounts'
          case 'post_media':
          default:
            return 'instagram_post_media'
        }
      },
      params: (params) => {
        const { credential, pageId, igUserId, caption, mediaUrl, action } = params

        if (action === 'list_accounts') {
          return {
            accessToken: credential?.accessToken,
            pageId: pageId?.trim() || undefined,
          }
        }

        if (!igUserId?.trim()) {
          throw new Error('Instagram Business Account ID (ig-user ID) is required to post media.')
        }

        return {
          igUserId: igUserId.trim(),
          caption,
          mediaUrl,
          accessToken: credential?.accessToken,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'json', required: true },
    pageId: { type: 'string', required: false },
    igUserId: { type: 'string', required: false },
    action: { type: 'string', required: true },
    caption: { type: 'string', required: false },
    mediaUrl: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        container: 'json',
        publish: 'json',
      },
    },
  },
})
