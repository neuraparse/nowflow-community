import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('SpeechToTextTool')

export interface SpeechToTextParams {
  audioUrl?: string
  audioBase64?: string
  language?: string
  provider?: 'openai' | 'deepgram' | 'google' | 'assemblyai'
  apiKey?: string
  includeTimestamps?: boolean
  diarization?: boolean
}

export interface SpeechToTextResponse extends ToolResponse {
  output: {
    text: string
    language?: string
    duration?: number
    words?: Array<{
      word: string
      start: number
      end: number
      confidence?: number
    }>
    speakers?: Array<{
      speaker: string
      text: string
      start: number
      end: number
    }>
  }
}

export const speechToTextTool: ToolConfig<SpeechToTextParams, SpeechToTextResponse> = {
  id: 'speech_to_text',
  name: 'Speech to Text',
  description:
    'Convert audio to text using various STT providers (OpenAI Whisper, Deepgram, Google, AssemblyAI)',
  version: '1.0.0',

  params: {
    audioUrl: {
      type: 'string',
      required: false,
      description: 'URL of the audio file to transcribe',
    },
    audioBase64: {
      type: 'string',
      required: false,
      description: 'Base64-encoded audio data',
    },
    language: {
      type: 'string',
      required: false,
      default: 'en',
      description: 'Language code (e.g., en, es, fr)',
    },
    provider: {
      type: 'string',
      required: false,
      default: 'openai',
      description: 'STT provider to use (openai, deepgram, google, assemblyai)',
    },
    apiKey: {
      type: 'string',
      required: false,
      description: 'API key for the STT provider (uses server env if not provided)',
      requiredForToolCall: false,
    },
    includeTimestamps: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Include word-level timestamps in response',
    },
    diarization: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Enable speaker diarization',
    },
  },

  request: {
    url: '/api/ai/speech-to-text',
    method: 'POST',
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (params) => ({
      audioUrl: params.audioUrl,
      audioBase64: params.audioBase64,
      language: params.language || 'en',
      provider: params.provider || 'openai',
      includeTimestamps: params.includeTimestamps || false,
      diarization: params.diarization || false,
    }),
    isInternalRoute: true,
  },

  transformResponse: async (response: Response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Speech-to-text API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      success: true,
      output: {
        text: data.text || '',
        language: data.language,
        duration: data.duration,
        words: data.words,
        speakers: data.speakers,
      },
    }
  },

  transformError: (error) => {
    logger.error('Speech-to-text error:', error)
    return `Error transcribing audio: ${error instanceof Error ? error.message : String(error)}`
  },
}

export default speechToTextTool
