'use client'

import { cn } from '@/lib/utils'

interface ModelIconProps {
  className?: string
}

// OpenAI logo
export function OpenAIIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

// Anthropic logo
export function AnthropicIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.476-3.93H5.756l-1.467 3.93H.686L6.569 3.52zm1.04 4.21L5.29 13.622h4.755L7.609 7.73z" />
    </svg>
  )
}

// Google Gemini logo
export function GoogleIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-4 h-4', className)}>
      <defs>
        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gemini-grad)"
        d="M12 0C5.352 0 0 5.352 0 12s5.352 12 12 12 12-5.352 12-12S18.648 0 12 0zm0 2.4c5.304 0 9.6 4.296 9.6 9.6s-4.296 9.6-9.6 9.6S2.4 17.304 2.4 12 6.696 2.4 12 2.4z"
      />
      <path
        fill="url(#gemini-grad)"
        d="M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8zm0 3.6c.6 0 1.08.48 1.08 1.08v3.24h3.24c.6 0 1.08.48 1.08 1.08s-.48 1.08-1.08 1.08h-3.24v3.24c0 .6-.48 1.08-1.08 1.08s-1.08-.48-1.08-1.08v-3.24H7.68c-.6 0-1.08-.48-1.08-1.08s.48-1.08 1.08-1.08h3.24V8.28c0-.6.48-1.08 1.08-1.08z"
      />
    </svg>
  )
}

// Google Gemini sparkle icon (more recognizable)
export function GeminiIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-4 h-4', className)} fill="none">
      <path d="M12 2C12 2 14.5 8.5 12 12C9.5 8.5 12 2 12 2Z" fill="url(#gemini-g1)" />
      <path d="M12 22C12 22 9.5 15.5 12 12C14.5 15.5 12 22 12 22Z" fill="url(#gemini-g2)" />
      <path d="M2 12C2 12 8.5 9.5 12 12C8.5 14.5 2 12 2 12Z" fill="url(#gemini-g3)" />
      <path d="M22 12C22 12 15.5 14.5 12 12C15.5 9.5 22 12 22 12Z" fill="url(#gemini-g4)" />
      <defs>
        <linearGradient id="gemini-g1" x1="12" y1="2" x2="12" y2="12">
          <stop stopColor="#1A73E8" />
          <stop offset="1" stopColor="#6C47FF" />
        </linearGradient>
        <linearGradient id="gemini-g2" x1="12" y1="12" x2="12" y2="22">
          <stop stopColor="#6C47FF" />
          <stop offset="1" stopColor="#E8710A" />
        </linearGradient>
        <linearGradient id="gemini-g3" x1="2" y1="12" x2="12" y2="12">
          <stop stopColor="#1A73E8" />
          <stop offset="1" stopColor="#6C47FF" />
        </linearGradient>
        <linearGradient id="gemini-g4" x1="12" y1="12" x2="22" y2="12">
          <stop stopColor="#6C47FF" />
          <stop offset="1" stopColor="#E8710A" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// DeepSeek logo
export function DeepSeekIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm-1.5 4a.75.75 0 0 0-.75.75v3h-3a.75.75 0 0 0 0 1.5h3v3a.75.75 0 0 0 1.5 0v-3h3a.75.75 0 0 0 0-1.5h-3v-3a.75.75 0 0 0-.75-.75z" />
    </svg>
  )
}

// xAI / Grok logo
export function XAIIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M2.87 3h4.82l5.09 7.55L17.28 3h4.82l-7.14 10.58L22.56 21h-4.82l-5.47-7.94L6.63 21H1.81l7.42-10.97L2.87 3z" />
    </svg>
  )
}

// Groq logo
export function GroqIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11.5v7l6-3.5-6-3.5z" />
    </svg>
  )
}

// Cerebras logo
export function CerebrasIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
    </svg>
  )
}

// Ollama logo
export function OllamaIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M12 2C8.5 2 6 4.5 6 7.5c0 1.5.5 2.8 1.3 3.8C6.5 12.3 6 13.6 6 15c0 3.3 2.7 6 6 6s6-2.7 6-6c0-1.4-.5-2.7-1.3-3.7.8-1 1.3-2.3 1.3-3.8C18 4.5 15.5 2 12 2zm0 2c2.2 0 4 1.8 4 3.5 0 1-.4 1.8-1 2.5-.6-.3-1.3-.5-2-.5h-2c-.7 0-1.4.2-2 .5-.6-.7-1-1.5-1-2.5C9 5.8 9.8 4 12 4zm0 6c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm-1.5 2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </svg>
  )
}

// Meta (Llama) logo for Groq's Llama models
export function MetaIcon({ className }: ModelIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('w-4 h-4', className)}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.5c4.69 0 8.5 3.81 8.5 8.5s-3.81 8.5-8.5 8.5S3.5 16.69 3.5 12 7.31 3.5 12 3.5zM8 8v8h2V9.6l2 4.4 2-4.4V16h2V8h-2.5l-1.5 3.5L10.5 8H8z" />
    </svg>
  )
}

// Provider ID to icon component mapping
const PROVIDER_ICONS: Record<string, React.ComponentType<ModelIconProps>> = {
  openai: OpenAIIcon,
  anthropic: AnthropicIcon,
  google: GeminiIcon,
  deepseek: DeepSeekIcon,
  xai: XAIIcon,
  groq: GroqIcon,
  cerebras: CerebrasIcon,
  ollama: OllamaIcon,
}

// Model-specific icon overrides (for models that have their own brand)
const MODEL_ICON_OVERRIDES: Record<string, React.ComponentType<ModelIconProps>> = {
  // Groq runs Meta's Llama models
  'llama-4-scout-17b-16e-instruct': MetaIcon,
  'llama-4-maverick-17b-128e-instruct': MetaIcon,
  'llama-3.3-70b-versatile': MetaIcon,
  // Groq also runs DeepSeek and Qwen
  'deepseek-r1-distill-llama-70b': DeepSeekIcon,
}

// Provider color schemes for styling
export const PROVIDER_COLORS: Record<
  string,
  { bg: string; text: string; border: string; accent: string }
> = {
  openai: {
    bg: 'bg-[#10a37f]/10',
    text: 'text-[#10a37f]',
    border: 'border-[#10a37f]/20',
    accent: '#10a37f',
  },
  anthropic: {
    bg: 'bg-[#d97706]/10',
    text: 'text-[#d97706]',
    border: 'border-[#d97706]/20',
    accent: '#d97706',
  },
  google: {
    bg: 'bg-[#4285f4]/10',
    text: 'text-[#4285f4]',
    border: 'border-[#4285f4]/20',
    accent: '#4285f4',
  },
  deepseek: {
    bg: 'bg-[#4D6BFE]/10',
    text: 'text-[#4D6BFE]',
    border: 'border-[#4D6BFE]/20',
    accent: '#4D6BFE',
  },
  xai: {
    bg: 'bg-[#f5f5f5]/10 dark:bg-[#ffffff]/10',
    text: 'text-foreground',
    border: 'border-foreground/20',
    accent: '#ffffff',
  },
  groq: {
    bg: 'bg-[#f55036]/10',
    text: 'text-[#f55036]',
    border: 'border-[#f55036]/20',
    accent: '#f55036',
  },
  cerebras: {
    bg: 'bg-[#ff6600]/10',
    text: 'text-[#ff6600]',
    border: 'border-[#ff6600]/20',
    accent: '#ff6600',
  },
  ollama: {
    bg: 'bg-[#ffffff]/10',
    text: 'text-foreground',
    border: 'border-foreground/20',
    accent: '#ffffff',
  },
}

/**
 * Get the icon component for a provider
 */
export function getProviderIcon(providerId: string): React.ComponentType<ModelIconProps> | null {
  return PROVIDER_ICONS[providerId] || null
}

/**
 * Get the icon component for a specific model (with provider fallback)
 */
export function getModelIcon(
  modelId: string,
  providerId?: string
): React.ComponentType<ModelIconProps> | null {
  // Check model-specific overrides first
  if (MODEL_ICON_OVERRIDES[modelId]) {
    return MODEL_ICON_OVERRIDES[modelId]
  }
  // Fall back to provider icon
  if (providerId) {
    return PROVIDER_ICONS[providerId] || null
  }
  return null
}

/**
 * Render a provider icon with optional color styling
 */
export function ProviderIcon({
  providerId,
  className,
  colored = true,
}: {
  providerId: string
  className?: string
  colored?: boolean
}) {
  const Icon = PROVIDER_ICONS[providerId]
  if (!Icon) return null

  const colors = PROVIDER_COLORS[providerId]
  return <Icon className={cn(colored && colors?.text, className)} />
}

/**
 * Render a model icon with optional color styling
 */
export function ModelIcon({
  modelId,
  providerId,
  className,
  colored = true,
}: {
  modelId: string
  providerId?: string
  className?: string
  colored?: boolean
}) {
  const Icon = MODEL_ICON_OVERRIDES[modelId] ?? (providerId ? PROVIDER_ICONS[providerId] : null)
  if (!Icon) return null

  const colors = providerId ? PROVIDER_COLORS[providerId] : undefined
  return <Icon className={cn(colored && colors?.text, className)} />
}
