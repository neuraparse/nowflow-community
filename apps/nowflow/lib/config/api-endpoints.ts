export const API_ENDPOINTS = {
  openai: {
    base: 'https://api.openai.com/v1',
    chat: 'https://api.openai.com/v1/chat/completions',
    models: 'https://api.openai.com/v1/models',
    embeddings: 'https://api.openai.com/v1/embeddings',
    images: 'https://api.openai.com/v1/images/generations',
  },
  anthropic: {
    messages: 'https://api.anthropic.com/v1/messages',
  },
  groq: {
    chat: 'https://api.groq.com/openai/v1/chat/completions',
    models: 'https://api.groq.com/openai/v1/models',
  },
  together: {
    chat: 'https://api.together.xyz/v1/chat/completions',
    models: 'https://api.together.xyz/v1/models',
  },
  deepseek: {
    base: 'https://api.deepseek.com/v1',
    chat: 'https://api.deepseek.com/v1/chat/completions',
    models: 'https://api.deepseek.com/v1/models',
  },
  xai: {
    base: 'https://api.x.ai/v1',
    chat: 'https://api.x.ai/v1/chat/completions',
    models: 'https://api.x.ai/v1/models',
  },
  google: {
    chat: 'https://generativelanguage.googleapis.com',
  },
} as const

export const OLLAMA_DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
