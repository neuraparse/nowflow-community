import { SpeakerWaveIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface TextToSpeechResponse extends ToolResponse {
  output: {
    audioUrl: string
    audioData: string | null
    format: string
    duration: number
    characterCount: number
    voice: string
    provider: string
  }
}

export const TextToSpeechBlock: BlockConfig<TextToSpeechResponse> = {
  type: 'text_to_speech',
  name: 'Text to Speech',
  description: 'Convert text to speech using multiple providers',
  longDescription:
    'Converts text to natural-sounding speech using various TTS providers including OpenAI, ElevenLabs, Google, and Deepgram.',
  category: 'tools',
  bgColor: '#8B5CF6',
  icon: SpeakerWaveIcon,
  subBlocks: [
    {
      id: 'provider',
      title: 'Provider',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'OpenAI TTS', id: 'openai' },
        { label: 'ElevenLabs', id: 'elevenlabs' },
        { label: 'Google TTS', id: 'google' },
        { label: 'Deepgram', id: 'deepgram' },
      ],
    },
    {
      id: 'text',
      title: 'Text',
      type: 'long-input',
      layout: 'full',
      placeholder: 'Text to convert to speech...',
      rows: 4,
    },
    {
      id: 'voice',
      title: 'Voice',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Alloy', id: 'alloy' },
        { label: 'Echo', id: 'echo' },
        { label: 'Fable', id: 'fable' },
        { label: 'Onyx', id: 'onyx' },
        { label: 'Nova', id: 'nova' },
        { label: 'Shimmer', id: 'shimmer' },
      ],
      condition: {
        field: 'provider',
        value: 'openai',
      },
    },
    {
      id: 'voice',
      title: 'Voice ID',
      type: 'short-input',
      layout: 'half',
      placeholder: 'Enter ElevenLabs voice ID',
      condition: {
        field: 'provider',
        value: 'elevenlabs',
      },
    },
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'TTS-1', id: 'tts-1' },
        { label: 'TTS-1 HD', id: 'tts-1-hd' },
      ],
      condition: {
        field: 'provider',
        value: 'openai',
      },
    },
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Eleven Multilingual v2', id: 'eleven_multilingual_v2' },
        { label: 'Eleven Turbo v2', id: 'eleven_turbo_v2' },
        { label: 'Eleven Monolingual v1', id: 'eleven_monolingual_v1' },
      ],
      condition: {
        field: 'provider',
        value: 'elevenlabs',
      },
    },
    {
      id: 'speed',
      title: 'Speed',
      type: 'slider',
      layout: 'half',
      min: 0.25,
      max: 4,
      condition: {
        field: 'provider',
        value: 'openai',
      },
    },
    {
      id: 'stability',
      title: 'Stability',
      type: 'slider',
      layout: 'half',
      min: 0,
      max: 1,
      condition: {
        field: 'provider',
        value: 'elevenlabs',
      },
    },
    {
      id: 'similarity',
      title: 'Similarity Boost',
      type: 'slider',
      layout: 'half',
      min: 0,
      max: 1,
      condition: {
        field: 'provider',
        value: 'elevenlabs',
      },
    },
    {
      id: 'outputFormat',
      title: 'Output Format',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'MP3', id: 'mp3' },
        { label: 'WAV', id: 'wav' },
        { label: 'OGG', id: 'ogg' },
        { label: 'FLAC', id: 'flac' },
      ],
    },
    {
      id: 'returnBase64',
      title: 'Return Base64',
      type: 'switch',
      layout: 'half',
      description: 'Return audio as base64 instead of URL',
    },
    {
      id: 'apiKey',
      title: 'API Key',
      type: 'short-input',
      layout: 'full',
      placeholder: 'API key or $ENV_VAR',
      password: true,
    },
  ],
  tools: {
    access: ['text_to_speech'],
    config: {
      tool: () => 'text_to_speech',
      params: (params) => ({
        provider: params.provider || 'openai',
        text: params.text,
        voice: params.voice || 'alloy',
        model: params.model || 'tts-1',
        speed: params.speed ?? 1,
        stability: params.stability ?? 0.5,
        similarity: params.similarity ?? 0.75,
        outputFormat: params.outputFormat || 'mp3',
        returnBase64: params.returnBase64 ?? false,
        apiKey: params.apiKey,
      }),
    },
  },
  inputs: {
    provider: { type: 'string', required: false },
    text: { type: 'string', required: true },
    voice: { type: 'string', required: false },
    model: { type: 'string', required: false },
    speed: { type: 'number', required: false },
    stability: { type: 'number', required: false },
    similarity: { type: 'number', required: false },
    outputFormat: { type: 'string', required: false },
    returnBase64: { type: 'boolean', required: false },
    apiKey: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        audioUrl: 'string',
        audioData: 'string',
        format: 'string',
        duration: 'number',
        characterCount: 'number',
        voice: 'string',
        provider: 'string',
      },
    },
  },
}
