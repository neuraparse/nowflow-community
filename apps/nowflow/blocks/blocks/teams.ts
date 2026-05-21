// @ts-nocheck
import { TeamsIcon } from '@/components/icons'
import { createOAuthSubBlock, createOperationDropdown } from '../helpers'
import { BlockDefinition } from '../types'

export const TeamsBlock: BlockDefinition = {
  id: 'teams',
  type: 'teams',
  name: 'Microsoft Teams',
  description: 'Send messages, create channels, and manage Teams communications',
  longDescription:
    'Integrate Microsoft Teams functionality to send messages, create channels, manage team communications, and send interactive Adaptive Cards within your workflow. Automate team collaboration using OAuth authentication.',
  category: 'tools',
  icon: TeamsIcon,
  color: '#6264A7', // Microsoft Teams purple
  bgColor: '#6264A7', // Microsoft Teams purple
  tool: 'teams',
  tools: {
    access: ['teams'],
    config: {
      tool: () => 'teams',
      params: (params) => params,
    },
  },
  subBlocks: [
    /*
    HIERARCHICAL FLOW:
    1. Connect Microsoft Teams Account
    2. Select Action (shows after credential connected)
    3. Select Target (team/channel/chat based on action)
    4. Enter Content (message/title/name based on action)

    FLOW EXAMPLES:
    Chat Message: Credential → Action → Chat/Email → Message
    Channel Message: Credential → Action → Team → Channel → Message
    Create Meeting: Credential → Action → Team → Meeting Title
    Create Channel: Credential → Action → Team → Channel Name → Description
    */

    // 1. Microsoft Teams Account Connection
    {
      ...createOAuthSubBlock({
        provider: 'microsoft',
        serviceId: 'microsoft-teams',
        requiredScopes: [
          'https://graph.microsoft.com/Chat.ReadWrite',
          'https://graph.microsoft.com/Channel.ReadBasic.All',
          'https://graph.microsoft.com/ChannelMessage.Send',
          'https://graph.microsoft.com/Team.ReadBasic.All',
          'https://graph.microsoft.com/TeamMember.Read.All',
          'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
        ],
        title: 'Microsoft Teams Account',
      }),
      description: 'Connect your Microsoft Teams account to send messages and manage teams',
    },

    // 2. Action Selection (shows after credential is connected)
    createOperationDropdown({
      id: 'action',
      title: 'What would you like to do?',
      operations: [
        { id: 'send_chat_message', label: '💬 Send Chat Message' },
        { id: 'send_channel_message', label: '📢 Send Channel Message' },
        { id: 'create_meeting', label: '📊 Create Meeting' },
        { id: 'create_channel', label: '📁 Create Channel' },
      ],
    }),

    // 3a. Chat Selection (for chat messages)
    {
      id: 'chatId',
      title: 'Select Chat or Enter Email',
      type: 'chats-selector',
      layout: 'full',
      placeholder: 'Choose existing chat or enter email address...',
      credentialSubBlockId: 'credential',
      allowEmailInput: true,
      condition: {
        field: 'action',
        value: 'send_chat_message',
      },
    },

    // 3b. Team Selection (for team operations)
    {
      id: 'teamId',
      title: 'Select Team',
      type: 'teams-selector',
      layout: 'full',
      placeholder: 'Choose a team...',
      provider: 'microsoft',
      serviceId: 'microsoft-teams',
      requiredScopes: [
        'https://graph.microsoft.com/Team.ReadBasic.All',
        'https://graph.microsoft.com/User.Read',
      ],
      condition: {
        field: 'action',
        value: ['send_channel_message', 'create_channel', 'create_meeting'],
      },
    },

    // 4. Channel Selection (for channel messages)
    {
      id: 'channelId',
      title: 'Select Channel',
      type: 'channels-selector',
      layout: 'full',
      placeholder: 'Choose a channel...',
      dependsOn: 'teamId',
      credentialSubBlockId: 'credential',
      condition: {
        field: 'action',
        value: 'send_channel_message',
      },
    },
    // 5a. Message Content (for chat and channel messages)
    {
      id: 'message',
      title: 'Message',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Type your message here...',
      rows: 3,
      condition: {
        field: 'action',
        value: ['send_chat_message', 'send_channel_message'],
      },
    },

    // 5b. Meeting Title (for meetings)
    {
      id: 'meetingTitle',
      title: 'Meeting Title',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter meeting title...',
      condition: {
        field: 'action',
        value: 'create_meeting',
      },
    },

    // 5c. Channel Name (for channel creation)
    {
      id: 'channelName',
      title: 'New Channel Name',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Enter channel name...',
      condition: {
        field: 'action',
        value: 'create_channel',
      },
    },

    // 6. Optional: Channel Description (for channel creation)
    {
      id: 'channelDescription',
      title: 'Channel Description (Optional)',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Describe what this channel is for...',
      rows: 2,
      condition: {
        field: 'action',
        value: 'create_channel',
      },
    },
  ],
  inputs: [
    {
      id: 'action',
      title: 'Action',
      type: 'select',
      required: true,
      options: [
        { value: 'send_message', label: 'Send Message' },
        { value: 'send_channel_message', label: 'Send Channel Message' },
        { value: 'create_channel', label: 'Create Channel' },
        { value: 'get_channels', label: 'Get Channels' },
        { value: 'get_team_members', label: 'Get Team Members' },
        { value: 'send_adaptive_card', label: 'Send Adaptive Card' },
      ],
      value: () => 'send_message',
    },
    {
      id: 'credential',
      title: 'Teams Credential',
      type: 'credential',
      required: true,
      credentialType: 'teams',
    },
    {
      id: 'teamId',
      title: 'Team ID',
      type: 'text',
      placeholder: 'Enter Team ID (required for team operations)',
      required: false,
      showWhen: {
        field: 'action',
        values: ['send_channel_message', 'create_channel', 'get_channels', 'get_team_members'],
      },
    },
    {
      id: 'channelId',
      title: 'Channel ID',
      type: 'text',
      placeholder: 'Enter Channel ID',
      required: false,
      showWhen: {
        field: 'action',
        values: ['send_channel_message'],
      },
    },
    {
      id: 'userId',
      title: 'User ID or Email',
      type: 'text',
      placeholder: 'Enter user ID or email address',
      required: false,
      showWhen: {
        field: 'action',
        values: ['send_message'],
      },
    },
    {
      id: 'message',
      title: 'Message',
      type: 'textarea',
      placeholder: 'Enter your message content',
      required: false,
      showWhen: {
        field: 'action',
        values: ['send_message', 'send_channel_message'],
      },
    },
    {
      id: 'channelName',
      title: 'Channel Name',
      type: 'text',
      placeholder: 'Enter channel name',
      required: false,
      showWhen: {
        field: 'action',
        values: ['create_channel'],
      },
    },
    {
      id: 'channelDescription',
      title: 'Channel Description',
      type: 'textarea',
      placeholder: 'Enter channel description (optional)',
      required: false,
      showWhen: {
        field: 'action',
        values: ['create_channel'],
      },
    },
    {
      id: 'channelType',
      title: 'Channel Type',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'private', label: 'Private' },
      ],
      value: () => 'standard',
      showWhen: {
        field: 'action',
        values: ['create_channel'],
      },
    },
    {
      id: 'adaptiveCard',
      title: 'Adaptive Card JSON',
      type: 'code',
      language: 'json',
      placeholder: 'Enter Adaptive Card JSON payload',
      required: false,
      showWhen: {
        field: 'action',
        values: ['send_adaptive_card'],
      },
    },
    {
      id: 'messageType',
      title: 'Message Type',
      type: 'select',
      options: [
        { value: 'text', label: 'Text' },
        { value: 'html', label: 'HTML' },
      ],
      value: () => 'text',
      showWhen: {
        field: 'action',
        values: ['send_message', 'send_channel_message'],
      },
    },
  ],
  outputs: [
    {
      id: 'success',
      title: 'Success',
      type: 'boolean',
    },
    {
      id: 'messageId',
      title: 'Message ID',
      type: 'string',
    },
    {
      id: 'channelId',
      title: 'Channel ID',
      type: 'string',
    },
    {
      id: 'data',
      title: 'Response Data',
      type: 'object',
    },
    {
      id: 'error',
      title: 'Error',
      type: 'string',
    },
  ],
  responseFormat: {
    success: 'boolean',
    messageId: 'string',
    channelId: 'string',
    data: 'object',
    error: 'string',
  },
  examples: [
    {
      title: 'Send Chat Message',
      description: 'Send a direct message to a user via chat',
      inputs: {
        action: 'send_chat_message',
        chatId: 'user@company.com',
        message: 'Hello! This is a message from the workflow.',
      },
    },
    {
      title: 'Send Channel Message',
      description: 'Send a message to a Teams channel',
      inputs: {
        action: 'send_channel_message',
        teamId: 'selected-team-id',
        channelId: 'selected-channel-id',
        message: 'Workflow notification: Task completed successfully!',
      },
    },
    {
      title: 'Create Team Meeting',
      description: 'Create an instant meeting for a team',
      inputs: {
        action: 'create_meeting',
        teamId: 'selected-team-id',
        meetingTitle: 'Weekly Project Review',
      },
    },
    {
      title: 'Create New Channel',
      description: 'Create a new channel in a team',
      inputs: {
        action: 'create_channel',
        teamId: 'selected-team-id',
        channelName: 'Project Updates',
        channelDescription: 'Channel for project status updates and announcements',
      },
    },
  ],
}
