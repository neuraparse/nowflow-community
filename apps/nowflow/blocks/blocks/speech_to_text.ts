import { MicrophoneIcon } from '@/components/icons'
import { ToolResponse } from '@/tools/types'
import { BlockConfig } from '../types'

interface SpeechToTextResponse extends ToolResponse {
  output: {
    transcript: string
    confidence: number
    language: string
    segments: Array<{
      text: string
      start: number
      end: number
      confidence: number
    }>
    words: Array<{
      word: string
      start: number
      end: number
      confidence: number
    }> | null
    duration: number
  }
}

export const SpeechToTextBlock: BlockConfig<SpeechToTextResponse> = {
  type: 'speech_to_text',
  name: 'Speech to Text',
  description: 'Convert audio to text using multiple providers',
  longDescription:
    'Transcribes audio files or streams to text using various speech recognition providers including OpenAI Whisper, Deepgram, and Google Speech-to-Text.',
  category: 'tools',
  bgColor: '#6366F1',
  icon: MicrophoneIcon,
  subBlocks: [
    {
      id: 'provider',
      title: 'Provider',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'OpenAI Whisper', id: 'openai' },
        { label: 'Deepgram', id: 'deepgram' },
        { label: 'Google Speech', id: 'google' },
        { label: 'AssemblyAI', id: 'assemblyai' },
      ],
    },
    {
      id: 'model',
      title: 'Model',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Whisper Large', id: 'whisper-large-v3' },
        { label: 'Whisper Medium', id: 'whisper-1' },
      ],
      condition: {
        field: 'provider',
        value: 'openai',
      },
    },
    {
      id: 'audioInput',
      title: 'Audio Input',
      type: 'short-input',
      layout: 'full',
      placeholder: 'Audio file path, URL, or base64 data',
    },
    {
      id: 'language',
      title: 'Language',
      type: 'dropdown',
      layout: 'half',
      options: [
        { label: 'Auto-detect', id: 'auto' },
        { label: 'English', id: 'en' },
        { label: 'Spanish', id: 'es' },
        { label: 'French', id: 'fr' },
        { label: 'German', id: 'de' },
        { label: 'Italian', id: 'it' },
        { label: 'Portuguese', id: 'pt' },
        { label: 'Japanese', id: 'ja' },
        { label: 'Korean', id: 'ko' },
        { label: 'Chinese', id: 'zh' },
        { label: 'Turkish', id: 'tr' },
      ],
    },
    {
      id: 'enableWordTimestamps',
      title: 'Word Timestamps',
      type: 'switch',
      layout: 'half',
      description: 'Include word-level timestamps',
    },
    {
      id: 'enableDiarization',
      title: 'Speaker Diarization',
      type: 'switch',
      layout: 'half',
      description: 'Identify different speakers',
      condition: {
        field: 'provider',
        value: ['deepgram', 'assemblyai'],
      },
    },
    {
      id: 'punctuate',
      title: 'Auto-Punctuation',
      type: 'switch',
      layout: 'half',
      description: 'Automatically add punctuation',
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
    access: ['speech_to_text'],
    config: {
      tool: () => 'speech_to_text',
      params: (params) => ({
        provider: params.provider || 'openai',
        model: params.model || 'whisper-1',
        audioInput: params.audioInput,
        language: params.language || 'auto',
        enableWordTimestamps: params.enableWordTimestamps ?? false,
        enableDiarization: params.enableDiarization ?? false,
        punctuate: params.punctuate ?? true,
        apiKey: params.apiKey,
      }),
    },
  },
  inputs: {
    provider: { type: 'string', required: false },
    model: { type: 'string', required: false },
    audioInput: { type: 'string', required: true },
    language: { type: 'string', required: false },
    enableWordTimestamps: { type: 'boolean', required: false },
    enableDiarization: { type: 'boolean', required: false },
    punctuate: { type: 'boolean', required: false },
    apiKey: { type: 'string', required: false },
  },
  outputs: {
    response: {
      type: {
        transcript: 'string',
        confidence: 'number',
        language: 'string',
        segments: 'json',
        words: 'json',
        duration: 'number',
      },
    },
  },
}
