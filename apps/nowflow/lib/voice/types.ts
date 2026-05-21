export interface VoiceCommand {
  id: string
  text: string // Transcribed text
  intent: VoiceIntent
  entities: VoiceEntity[]
  confidence: number
  language: string
  userId: string
  timestamp: Date
  audioMetadata?: {
    duration: number
    format: string
    sampleRate: number
  }
}

export type VoiceIntent =
  | 'run_workflow'
  | 'check_status'
  | 'list_workflows'
  | 'stop_workflow'
  | 'get_results'
  | 'create_workflow'
  | 'help'
  | 'unknown'

export interface VoiceEntity {
  type: 'workflow_name' | 'workflow_id' | 'status' | 'time_range' | 'action'
  value: string
  confidence: number
}

export interface VoiceResponse {
  text: string // Text to speak back
  ssml?: string // SSML for richer speech
  action?: VoiceAction
  data?: Record<string, any>
}

export interface VoiceAction {
  type: 'execute_workflow' | 'show_status' | 'navigate' | 'none'
  workflowId?: string
  params?: Record<string, any>
}

export interface VoiceSession {
  id: string
  userId: string
  status: 'listening' | 'processing' | 'responding' | 'idle'
  lastCommandAt: Date
  commandHistory: Array<{ command: string; response: string; timestamp: Date }>
  context: Record<string, any> // Conversation context for follow-ups
}

export interface TranscriptionResult {
  text: string
  language: string
  confidence: number
  words?: Array<{
    word: string
    start: number
    end: number
    confidence: number
  }>
}
