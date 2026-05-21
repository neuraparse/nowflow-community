import { agentMessageTool } from './agent_message'
import {
  airtableCreateRecordsTool,
  airtableGetRecordTool,
  airtableListRecordsTool,
  airtableUpdateRecordTool,
} from './airtable'
import { anthropicChatTool } from './anthropic'
import { asanaTasksTool } from './asana/tasks'
import { autoblocksPromptManagerTool } from './autoblocks'
import { boxFilesTool } from './box/files'
import { calendlyEventsTool } from './calendly'
import { clayPopulateTool } from './clay'
import { clickupTasksTool } from './clickup/tasks'
import { confluenceRetrieveTool, confluenceUpdateTool } from './confluence'
import { dataTableManagerTool } from './data-table/tool'
import { discordMessagesTool } from './discord/messages'
import { dropboxFilesTool } from './dropbox/files'
import { elevenLabsTtsTool } from './elevenlabs'
import {
  facebookListPagesTool,
  facebookPageInfoTool,
  facebookPagePostsTool,
  facebookPostTool,
} from './facebook'
import { fileParseTool } from './file'
import { functionExecuteTool } from './function'
import {
  githubCommentTool,
  githubLatestCommitTool,
  githubPrTool,
  githubRepoInfoTool,
} from './github'
import { gitlabIssuesTool } from './gitlab/issues'
import {
  gmailForwardTool,
  gmailListLabelsTool,
  gmailModifyLabelsTool,
  gmailReadTool,
  gmailReplyTool,
  gmailSearchTool,
  gmailSendTool,
  gmailTrashTool,
} from './gmail'
import { googleCalendarEventsTool } from './google_calendar/events'
import { docsCreateTool, docsReadTool, docsWriteTool } from './google_docs'
import { driveDownloadTool, driveListTool, driveUploadTool } from './google_drive'
import {
  sheetsAppendTool,
  sheetsReadTool,
  sheetsUpdateTool,
  sheetsWriteTool,
} from './google_sheets'
import { guestyGuestTool, guestyReservationTool } from './guesty'
import { hitlApprovalTool } from './hitl_approval'
import { requestTool as httpRequest } from './http'
import { contactsTool as hubspotContacts } from './hubspot/contacts'
import { instagramListAccountsTool, instagramPostMediaTool } from './instagram'
import { intercomConversationsTool } from './intercom/conversations'
import { jiraBulkRetrieveTool, jiraRetrieveTool, jiraUpdateTool, jiraWriteTool } from './jira'
import { jsonProcessorTool } from './json_processor/tool'
import { linearIssuesTool } from './linear/issues'
import {
  linkedin_add_comment,
  linkedin_add_reaction,
  linkedin_get_post_analytics,
  linkedin_get_post_details,
  linkedin_get_posts,
  linkedin_profile,
  linkedin_share,
} from './linkedin'
import { loopProcessorTool } from './loop_processor/tool'
import { mailchimpMarketingTool } from './mailchimp'
import { mathProcessorTool } from './math_processor/tool'
import { mem0AddMemoriesTool, mem0GetMemoriesTool, mem0SearchMemoriesTool } from './mem0'
import { mistralParserTool } from './mistral'
import { mondayItemsTool } from './monday/items'
import { notionReadTool, notionWriteTool } from './notion'
import { oneDriveFilesTool } from './onedrive/files'
import { dalleTool, embeddingsTool as openAIEmbeddings } from './openai'
import {
  outlook_mail_forward,
  outlook_mail_list_folders,
  outlook_mail_read,
  outlook_mail_reply,
  outlook_mail_search,
  outlook_mail_send,
  outlook_mail_update,
  outlookCalendarTool,
} from './outlook'
import {
  pineconeFetchTool,
  pineconeGenerateEmbeddingsTool,
  pineconeSearchTextTool,
  pineconeSearchVectorTool,
  pineconeUpsertTextTool,
} from './pinecone'
import { pipedriveDealsTool } from './pipedrive/deals'
import { redditGetCommentsTool, redditGetPostsTool, redditHotPostsTool } from './reddit'
import { s3GetObjectTool } from './s3'
import { opportunitiesTool as salesforceOpportunities } from './salesforce/opportunities'
import { sapODataTool } from './sap/odata'
import { sendGridSendTool } from './sendgrid'
import { serviceNowTableTool } from './servicenow/table'
import { sharedMemoryTool } from './shared_memory'
import { sharepointListsTool } from './sharepoint/lists'
import { shopifyOrdersTool } from './shopify/orders'
import { slackMessageTool } from './slack'
import { speechToTextTool } from './speech_to_text'
import { stripePaymentsTool } from './stripe'
import { supabaseInsertTool, supabaseQueryTool } from './supabase'
import { teamsTool } from './teams'
import { telegramMessageTool } from './telegram'
import { textProcessorTool } from './text_processor/tool'
import { textToSpeechTool } from './text_to_speech'
import { thinkingTool } from './thinking'
import { timerTool } from './timer/tool'
import { trelloCardsTool } from './trello/cards'
import { sendSMSTool } from './twilio'
import { typeformFilesTool, typeformInsightsTool, typeformResponsesTool } from './typeform'
import { ToolConfig } from './types'
import { variableManagerTool } from './variable_manager/tool'
import { visionTool } from './vision'
import { whatsappListPhoneNumbersTool, whatsappSendMessageTool } from './whatsapp'
import { xReadTool, xSearchTool, xUserTool, xWriteTool } from './x'
import {
  youtubeChannelInfoTool,
  youtubeSearchTool,
  youtubeTranscriptTool,
  youtubeVideoDetailsTool,
} from './youtube'
import { zendeskTicketsTool } from './zendesk/tickets'
import { zoomMeetingsTool } from './zoom/meetings'

// Registry of all available tools
export const tools: Record<string, ToolConfig> = {
  autoblocks_prompt_manager: autoblocksPromptManagerTool,
  openai_embeddings: openAIEmbeddings,
  http_request: httpRequest,
  hubspot_contacts: hubspotContacts,
  salesforce_opportunities: salesforceOpportunities,
  function_execute: functionExecuteTool,
  vision_tool: visionTool,
  file_parser: fileParseTool,
  jira_retrieve: jiraRetrieveTool,
  jira_update: jiraUpdateTool,
  jira_write: jiraWriteTool,
  jira_bulk_read: jiraBulkRetrieveTool,
  slack_message: slackMessageTool,
  github_repo_info: githubRepoInfoTool,
  github_latest_commit: githubLatestCommitTool,
  supabase_query: supabaseQueryTool,
  supabase_insert: supabaseInsertTool,
  typeform_responses: typeformResponsesTool,
  typeform_files: typeformFilesTool,
  typeform_insights: typeformInsightsTool,
  youtube_search: youtubeSearchTool,
  youtube_video_details: youtubeVideoDetailsTool,
  youtube_transcript: youtubeTranscriptTool,
  youtube_channel_info: youtubeChannelInfoTool,
  notion_read: notionReadTool,
  notion_write: notionWriteTool,
  gmail_send: gmailSendTool,
  gmail_read: gmailReadTool,
  gmail_search: gmailSearchTool,
  gmail_trash: gmailTrashTool,
  gmail_reply: gmailReplyTool,
  gmail_forward: gmailForwardTool,
  gmail_list_labels: gmailListLabelsTool,
  gmail_modify_labels: gmailModifyLabelsTool,
  whatsapp_send_message: whatsappSendMessageTool,
  whatsapp_list_phone_numbers: whatsappListPhoneNumbersTool,
  facebook_post: facebookPostTool,
  facebook_page_info: facebookPageInfoTool,
  facebook_page_posts: facebookPagePostsTool,
  facebook_list_pages: facebookListPagesTool,
  x_write: xWriteTool,
  x_read: xReadTool,
  x_search: xSearchTool,
  x_user: xUserTool,
  pinecone_fetch: pineconeFetchTool,
  pinecone_generate_embeddings: pineconeGenerateEmbeddingsTool,
  pinecone_search_text: pineconeSearchTextTool,
  pinecone_search_vector: pineconeSearchVectorTool,
  pinecone_upsert_text: pineconeUpsertTextTool,
  github_pr: githubPrTool,
  github_comment: githubCommentTool,
  reddit_hot_posts: redditHotPostsTool,
  reddit_get_posts: redditGetPostsTool,
  reddit_get_comments: redditGetCommentsTool,
  google_drive_download: driveDownloadTool,
  google_drive_list: driveListTool,
  google_drive_upload: driveUploadTool,
  google_docs_read: docsReadTool,
  google_docs_write: docsWriteTool,
  google_docs_create: docsCreateTool,
  google_sheets_read: sheetsReadTool,
  google_sheets_write: sheetsWriteTool,
  google_sheets_update: sheetsUpdateTool,
  google_sheets_append: sheetsAppendTool,
  guesty_reservation: guestyReservationTool,
  guesty_guest: guestyGuestTool,
  confluence_retrieve: confluenceRetrieveTool,
  confluence_update: confluenceUpdateTool,
  twilio_send_sms: sendSMSTool,
  openai_dalle: dalleTool,
  airtable_create_records: airtableCreateRecordsTool,
  airtable_get_record: airtableGetRecordTool,
  airtable_list_records: airtableListRecordsTool,
  airtable_update_record: airtableUpdateRecordTool,
  mistral_parser: mistralParserTool,
  thinking_tool: thinkingTool,
  data_table_manager: dataTableManagerTool,
  mem0_add_memories: mem0AddMemoriesTool,
  mem0_search_memories: mem0SearchMemoriesTool,
  mem0_get_memories: mem0GetMemoriesTool,
  elevenlabs_tts: elevenLabsTtsTool,
  speech_to_text: speechToTextTool,
  text_to_speech: textToSpeechTool,
  agent_message: agentMessageTool,
  shared_memory: sharedMemoryTool,
  hitl_approval: hitlApprovalTool,
  s3_get_object: s3GetObjectTool,
  teams: teamsTool,
  telegram_message: telegramMessageTool,
  text_processor: textProcessorTool,
  timer: timerTool,
  variable_manager: variableManagerTool,
  json_processor: jsonProcessorTool,
  math_processor: mathProcessorTool,
  loop_processor: loopProcessorTool,
  clay_populate: clayPopulateTool,
  instagram_post_media: instagramPostMediaTool,
  instagram_list_accounts: instagramListAccountsTool,
  servicenow_table: serviceNowTableTool,
  shopify_orders: shopifyOrdersTool,
  sap_odata: sapODataTool,
  discord_messages: discordMessagesTool,
  gitlab_issues: gitlabIssuesTool,
  trello_cards: trelloCardsTool,
  asana_tasks: asanaTasksTool,
  linear_issues: linearIssuesTool,
  dropbox_files: dropboxFilesTool,
  zendesk_tickets: zendeskTicketsTool,
  clickup_tasks: clickupTasksTool,
  google_calendar_events: googleCalendarEventsTool,
  intercom_conversations: intercomConversationsTool,
  monday_items: mondayItemsTool,
  zoom_meetings: zoomMeetingsTool,
  onedrive_files: oneDriveFilesTool,
  outlook_calendar_events: outlookCalendarTool,
  outlook_mail_send: outlook_mail_send,
  outlook_mail_read: outlook_mail_read,
  outlook_mail_search: outlook_mail_search,
  outlook_mail_list_folders: outlook_mail_list_folders,
  outlook_mail_update: outlook_mail_update,
  outlook_mail_reply: outlook_mail_reply,
  outlook_mail_forward: outlook_mail_forward,
  linkedin_share: linkedin_share,
  linkedin_profile: linkedin_profile,
  linkedin_get_posts: linkedin_get_posts,
  linkedin_get_post_analytics: linkedin_get_post_analytics,
  linkedin_add_comment: linkedin_add_comment,
  linkedin_add_reaction: linkedin_add_reaction,
  linkedin_get_post_details: linkedin_get_post_details,
  sharepoint_lists: sharepointListsTool,
  box_files: boxFilesTool,
  pipedrive_deals: pipedriveDealsTool,
  // New 2025 integrations
  stripe_payments: stripePaymentsTool,
  calendly_events: calendlyEventsTool,
  sendgrid_send: sendGridSendTool,
  mailchimp_marketing: mailchimpMarketingTool,
  anthropic_chat: anthropicChatTool,
}
