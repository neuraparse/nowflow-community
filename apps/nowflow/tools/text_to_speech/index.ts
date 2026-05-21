import { createLogger } from '@/lib/logs/console-logger'
import { ToolConfig, ToolResponse } from '../types'

const logger = createLogger('TextToSpeechTool')

export interface TextToSpeechParams {
  text: string
  provider?: 'openai' | 'elevenlabs' | 'google' | 'deepgram'
  voice?: string
  model?: string
  apiKey?: string
  speed?: number
  pitch?: number
  outputFormat?: 'mp3' | 'wav' | 'ogg'
}

export interface TextToSpeechResponse extends ToolResponse {
  output: {
    audioUrl?: string
    audioBase64?: string
    duration?: number
    characterCount?: number
  }
}

export const textToSpeechTool: ToolConfig<TextToSpeechParams, TextToSpeechResponse> = {
  id: 'text_to_speech',
  name: 'Text to Speech',
  description:
    'Convert text to speech using various TTS providers (OpenAI, ElevenLabs, Google, Deepgram)',
  version: '1.0.0',

  params: {
    text: {
      type: 'string',
      required: true,
      description: 'The text to convert to speech',
    },
    provider: {
      type: 'string',
      required: false,
      default: 'openai',
      description: 'TTS provider to use (openai, elevenlabs, google, deepgram)',
    },
    voice: {
      type: 'string',
      required: false,
      description: 'Voice ID or name to use',
    },
    model: {
      type: 'string',
      required: false,
      description: 'Model ID to use (provider-specific)',
    },
    apiKey: {
      type: 'string',
      required: false,
      description: 'API key for the TTS provider (uses server env if not provided)',
      requiredForToolCall: false,
    },
    speed: {
      type: 'number',
      required: false,
      default: 1.0,
      description: 'Speech speed (0.5 to 2.0)',
    },
    pitch: {
      type: 'number',
      required: false,
      description: 'Voice pitch adjustment',
    },
    outputFormat: {
      type: 'string',
      required: false,
      default: 'mp3',
      description: 'Output audio format (mp3, wav, ogg)',
    },
  },

  request: {
    url: (params) => {
      // Route to different endpoints based on provider
      if (params.provider === 'elevenlabs') {
        return '/api/proxy/tts'
      }
      return '/api/ai/text-to-speech'
    },
    method: 'POST',
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    body: (params) => ({
      text: params.text,
      provider: params.provider || 'openai',
      voice: params.voice,
      model: params.model,
      apiKey: params.apiKey,
      speed: params.speed || 1.0,
      pitch: params.pitch,
      outputFormat: params.outputFormat || 'mp3',
      // ElevenLabs specific
      voiceId: params.voice,
      modelId: params.model,
    }),
    isInternalRoute: true,
  },

  transformResponse: async (response: Response) => {
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Text-to-speech API error: ${response.status} ${errorText}`)
    }

    const contentType = response.headers.get('content-type') || ''

    // Handle audio blob response
    if (contentType.includes('audio/')) {
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      return {
        success: true,
        output: {
          audioUrl,
          characterCount: 0, // Unknown from blob response
        },
      }
    }

    // Handle JSON response with audio data
    const data = await response.json()
    return {
      success: true,
      output: {
        audioUrl: data.audioUrl,
        audioBase64: data.audioBase64,
        duration: data.duration,
        characterCount: data.characterCount,
      },
    }
  },

  transformError: (error) => {
    logger.error('Text-to-speech error:', error)
    return `Error generating speech: ${error instanceof Error ? error.message : String(error)}`
  },
}

export default textToSpeechTool
