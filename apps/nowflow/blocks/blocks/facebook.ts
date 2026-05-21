import { FacebookIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown, defineBlock } from '../helpers'

export const FacebookBlock = defineBlock({
  type: 'facebook',
  name: 'Facebook',
  description: 'Facebook Pages API operations (post, get page info, get posts).',
  longDescription:
    'Manage Facebook Pages via the Graph API - create posts, get page information, and retrieve posts.',
  category: 'tools',
  bgColor: '#1877F2',
  icon: FacebookIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'meta-facebook',
      serviceId: 'meta-facebook',
      requiredScopes: [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list',
        'pages_manage_metadata',
        'pages_read_user_content',
        'business_management',
      ],
      title: 'Facebook Page Account',
      placeholder: 'Select Meta account for Facebook Pages',
    }),
    {
      id: 'pageId',
      title: 'Page ID',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Facebook Page ID',
    },
    createOperationDropdown({
      id: 'action',
      title: 'Action',
      operations: [
        { id: 'list_pages', label: 'List My Pages' },
        { id: 'post', label: 'Create Post' },
        { id: 'page_info', label: 'Get Page Info' },
        { id: 'page_posts', label: 'Get Page Posts' },
      ],
    }),
    {
      id: 'message',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Post message content',
    },
    {
      id: 'link',
      title: 'Link URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'URL to share in the post',
    },
    {
      id: 'imageUrl',
      title: 'Image URL',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Image URL to include in the post',
    },
    {
      id: 'published',
      title: 'Publish Immediately',
      type: 'checkbox',
      layout: 'half',
    },
    {
      id: 'limit',
      title: 'Posts Limit',
      type: 'short-input',
      layout: 'half',
      placeholder: '25',
    },
  ],
  tools: {
    access: ['facebook_post', 'facebook_page_info', 'facebook_page_posts', 'facebook_list_pages'],
    config: {
      tool: (params) => {
        switch (params.action) {
          case 'list_pages':
            return 'facebook_list_pages'
          case 'post':
            return 'facebook_post'
          case 'page_info':
            return 'facebook_page_info'
          case 'page_posts':
            return 'facebook_page_posts'
          default:
            return 'facebook_list_pages'
        }
      },
      params: (params) => {
        const { credential, pageId, message, link, imageUrl, published, limit } = params

        const baseParams = {
          accessToken: credential?.accessToken,
          pageId,
        }

        switch (params.action) {
          case 'list_pages':
            return {
              accessToken: credential?.accessToken,
            }
          case 'post':
            return {
              ...baseParams,
              message,
              link,
              imageUrl,
              published: published !== false,
            }
          case 'page_info':
            return baseParams
          case 'page_posts':
            return {
              ...baseParams,
              limit: limit ? parseInt(limit) : 25,
            }
          default:
            return {
              accessToken: credential?.accessToken,
            }
        }
      },
    },
  },
  inputs: {
    credential: { type: 'json', required: true },
    pageId: { type: 'string', required: true },
    action: { type: 'string', required: true },
    message: { type: 'string', required: false },
    link: { type: 'string', required: false },
    imageUrl: { type: 'string', required: false },
    published: { type: 'boolean', required: false },
    limit: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        success: 'boolean',
        data: 'json',
        error: 'string',
      },
    },
  },
})
