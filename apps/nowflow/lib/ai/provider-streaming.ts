// ---------------------------------------------------------------------------
// Streaming implementations for AI providers
// ---------------------------------------------------------------------------
import { API_ENDPOINTS } from '@/lib/config/api-endpoints'
import { createLogger } from '@/lib/logs/console-logger'

const streamingLogger = createLogger('provider-streaming')

// Rough char-based heuristic for the ~1024 token cache-eligibility threshold
// (Anthropic requires >= 1024 tokens per cache block for Sonnet/Opus).
// ~4 chars per token → 4096 chars.
const CACHE_MIN_CHARS = 4096

type AnthropicSystemBlock = {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

export type AnthropicCacheHint = 'ephemeral'

export type StreamAnthropicOptions = {
  // Additional static blob (e.g. tool catalog / block catalog) that should be
  // cached alongside the system prompt as a second system block.
  staticContext?: string
  // Opt-in cache_control hint. Defaults to 'ephemeral' when the system prompt
  // exceeds the token-count heuristic; pass `null` to force-disable.
  cacheHint?: AnthropicCacheHint | null
}

export function streamOpenAICompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
          }),
        })

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => response.statusText)
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: errText })}\n\n`)
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed === 'data: [DONE]') {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
              controller.close()
              return
            }
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                const content = data.choices?.[0]?.delta?.content
                if (content) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
                  )
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`
          )
        )
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}

// Exported for tests: builds the request body that is sent to Anthropic.
// Keeps the caching wire logic in one inspectable place.
export function buildAnthropicRequestBody(params: {
  model: string
  messages: Array<{ role: string; content: string }>
  systemPrompt: string
  temperature: number
  maxTokens: number
  options?: StreamAnthropicOptions
}): {
  body: {
    model: string
    max_tokens: number
    temperature: number
    stream: true
    system?: string | AnthropicSystemBlock[]
    messages: Array<{ role: string; content: string }>
  }
  cachedBlocks: number
} {
  const { model, messages, systemPrompt, temperature, maxTokens, options } = params

  const nonSystemMessages = messages.filter((m) => m.role !== 'system')
  const mergedSystemPrompt = [
    systemPrompt,
    ...messages.filter((m) => m.role === 'system').map((m) => m.content),
  ]
    .filter(Boolean)
    .join('\n\n')

  const staticContext = options?.staticContext?.trim() ? options.staticContext : undefined

  // Decide whether cache_control should be attached.
  // Explicit hint wins; otherwise auto-enable when the primary system prompt
  // crosses the ~1024-token heuristic or a static blob is provided.
  const autoEnable =
    mergedSystemPrompt.length >= CACHE_MIN_CHARS ||
    (staticContext !== undefined && staticContext.length >= CACHE_MIN_CHARS)
  const cacheEnabled =
    options?.cacheHint === null ? false : options?.cacheHint === 'ephemeral' ? true : autoEnable

  // Build system as either a plain string (no caching, preserves legacy shape)
  // or as a block array when caching is requested.
  let system: string | AnthropicSystemBlock[] | undefined
  let cachedBlocks = 0

  if (!mergedSystemPrompt && !staticContext) {
    system = undefined
  } else if (cacheEnabled) {
    const blocks: AnthropicSystemBlock[] = []
    if (mergedSystemPrompt) {
      blocks.push({
        type: 'text',
        text: mergedSystemPrompt,
        cache_control: { type: 'ephemeral' },
      })
      cachedBlocks += 1
    }
    if (staticContext) {
      blocks.push({
        type: 'text',
        text: staticContext,
        cache_control: { type: 'ephemeral' },
      })
      cachedBlocks += 1
    }
    system = blocks
  } else {
    // No caching: keep the legacy single-string system shape so existing
    // behavior is byte-for-byte preserved.
    system = staticContext
      ? [mergedSystemPrompt, staticContext].filter(Boolean).join('\n\n')
      : mergedSystemPrompt
  }

  return {
    body: {
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      ...(system !== undefined ? { system } : {}),
      messages: nonSystemMessages,
    },
    cachedBlocks,
  }
}

export function streamAnthropic(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  temperature: number,
  maxTokens: number,
  options?: StreamAnthropicOptions
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        const { body, cachedBlocks } = buildAnthropicRequestBody({
          model,
          messages,
          systemPrompt,
          temperature,
          maxTokens,
          options,
        })

        if (cachedBlocks > 0) {
          streamingLogger.debug('prompt cache enabled', { blocks: cachedBlocks })
        }

        const response = await fetch(API_ENDPOINTS.anthropic.messages, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => response.statusText)
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: errText })}\n\n`)
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                if (data.type === 'content_block_delta' && data.delta?.text) {
                  controller.enqueue(
                    new TextEncoder().encode(
                      `data: ${JSON.stringify({ content: data.delta.text })}\n\n`
                    )
                  )
                }
                if (data.type === 'message_stop') {
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                  controller.close()
                  return
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`
          )
        )
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}

export function streamGoogle(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        const systemMessages = messages.filter((m) => m.role === 'system')
        const nonSystemMessages = messages.filter((m) => m.role !== 'system')
        const systemInstruction = systemMessages.map((m) => m.content).join('\n\n')
        const contents = nonSystemMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))

        const response = await fetch(
          `${API_ENDPOINTS.google.chat}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              ...(systemInstruction
                ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
                : {}),
              generationConfig: { temperature, maxOutputTokens: maxTokens },
            }),
          }
        )

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => response.statusText)
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: errText })}\n\n`)
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6))
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content: text })}\n\n`)
                  )
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`
          )
        )
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}

export function streamOllama(
  model: string,
  ollamaHost: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${ollamaHost}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            options: { temperature, num_predict: maxTokens },
            stream: true,
          }),
        })

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => response.statusText)
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: errText })}\n\n`)
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const data = JSON.parse(trimmed)
              if (data.message?.content) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ content: data.message.content })}\n\n`
                  )
                )
              }
              if (data.done) {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
                controller.close()
                return
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`
          )
        )
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}
