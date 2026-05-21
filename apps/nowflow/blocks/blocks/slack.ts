import { SlackIcon } from '@/components/icons'
import { SlackMessageResponse } from '@/tools/slack/types'
import { createOAuthSubBlock, defineBlock } from '../helpers'

// TODO(workflow-state-migration): Existing Slack blocks in user workflows
// reference an inline `apiKey` short-input that previously held the OAuth
// token directly. With the move to the OAuth credential picker
// (`createOAuthSubBlock`), the field is now `credential` (the selected OAuth
// account ID, resolved to an access token at runtime). A one-time migration
// is required to either:
//   1. Rewrite stored block state: `{ apiKey: '<token>' }` ->
//      `{ credential: '<oauth-account-id>' }` once the user reconnects, or
//   2. Surface a "reconnect Slack" prompt for any block whose state still
//      contains a non-empty `apiKey` and no `credential`.
// Until that migration ships, old workflows will fail validation because the
// `credential` input is required and `apiKey` is no longer in the subBlocks.
//
// TODO(provider-definition): No `providerId: 'slack'` entry exists in
// `lib/auth/providers/individual.ts` yet. The OAuth credential picker will
// not surface any accounts until that provider is registered. Adding the
// provider is intentionally out of scope for this migration.

export const SlackBlock = defineBlock<SlackMessageResponse>({
  type: 'slack',
  name: 'Slack',
  description: 'Send a message to Slack',
  longDescription:
    'Send messages to any Slack channel using OAuth authentication. Integrate automated notifications and alerts into your workflow to keep your team informed.',
  category: 'tools',
  bgColor: '#611f69',
  icon: SlackIcon,
  subBlocks: [
    createOAuthSubBlock({
      provider: 'slack',
      serviceId: 'slack',
      requiredScopes: ['chat:write', 'chat:write.public', 'channels:read'],
      title: 'Slack Account',
      placeholder: 'Select Slack account',
    }),
    {
      id: 'channel',
      title: 'Channel',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter Slack channel (e.g., #general)',
    },
    {
      id: 'text',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Enter your alert message',
    },
  ],
  tools: {
    access: ['slack_message'],
    config: {
      tool: () => 'slack_message',
      params: (params) => {
        const { credential, channel, text } = params
        // The Slack message tool expects `apiKey` (Bearer token). The
        // credential picker hands us the selected OAuth account ID, which
        // the executor resolves to a live access token before dispatch.
        return {
          apiKey: credential,
          channel,
          text,
        }
      },
    },
  },
  inputs: {
    credential: { type: 'string', required: true },
    channel: { type: 'string', required: true },
    text: { type: 'string', required: true },
  },
  outputs: {
    response: {
      type: {
        ts: 'string',
        channel: 'string',
      },
    },
  },
})
