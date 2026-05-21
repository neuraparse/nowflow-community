import { createLogger } from '@/lib/logs/console-logger'

const logger = createLogger('SentimentAnalyzer')

export interface SentimentResult {
  score: number // -1 to 1 (-1 = very negative, 0 = neutral, 1 = very positive)
  label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive'
  confidence: number // 0 to 1
  emotions: EmotionScore[]
  summary?: string
}

export interface EmotionScore {
  emotion: string // joy, anger, sadness, fear, surprise, disgust, trust, anticipation
  score: number // 0 to 1
}

export interface ConversationSummary {
  title: string
  summary: string
  keyTopics: string[]
  sentiment: SentimentResult
  messageCount: number
  duration: number // in seconds
  resolution: 'resolved' | 'unresolved' | 'escalated' | 'unknown'
}

// Positive and negative word lists for basic sentiment
const POSITIVE_WORDS = new Set([
  'good',
  'great',
  'excellent',
  'amazing',
  'wonderful',
  'fantastic',
  'awesome',
  'love',
  'like',
  'enjoy',
  'happy',
  'glad',
  'pleased',
  'satisfied',
  'perfect',
  'helpful',
  'thanks',
  'thank',
  'appreciate',
  'brilliant',
  'superb',
  'nice',
  'best',
  'better',
  'improved',
  'solved',
  'fixed',
  'works',
  'working',
])

const NEGATIVE_WORDS = new Set([
  'bad',
  'terrible',
  'awful',
  'horrible',
  'poor',
  'worst',
  'hate',
  'dislike',
  'angry',
  'frustrated',
  'annoyed',
  'disappointed',
  'upset',
  'broken',
  'bug',
  'error',
  'fail',
  'failed',
  'failing',
  'issue',
  'problem',
  'wrong',
  'stuck',
  'slow',
  'crash',
  'crashes',
  'unresponsive',
  'useless',
  'waste',
])

const INTENSIFIERS = new Set([
  'very',
  'extremely',
  'really',
  'so',
  'absolutely',
  'totally',
  'completely',
])
const NEGATORS = new Set([
  'not',
  "don't",
  "doesn't",
  "didn't",
  "won't",
  "can't",
  "couldn't",
  'no',
  'never',
])

/**
 * Analyze sentiment of a text using lexicon-based approach
 * (In production, would use an AI model for better accuracy)
 */
export function analyzeSentiment(text: string): SentimentResult {
  const words = text.toLowerCase().split(/\s+/)
  let score = 0
  let wordCount = 0
  let isNegated = false
  let isIntensified = false

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, '')

    if (NEGATORS.has(word)) {
      isNegated = true
      continue
    }

    if (INTENSIFIERS.has(word)) {
      isIntensified = true
      continue
    }

    let wordScore = 0
    if (POSITIVE_WORDS.has(word)) {
      wordScore = 1
    } else if (NEGATIVE_WORDS.has(word)) {
      wordScore = -1
    }

    if (wordScore !== 0) {
      if (isNegated) wordScore *= -1
      if (isIntensified) wordScore *= 1.5
      score += wordScore
      wordCount++
      isNegated = false
      isIntensified = false
    }
  }

  const normalizedScore =
    wordCount > 0 ? Math.max(-1, Math.min(1, score / Math.sqrt(wordCount))) : 0
  const confidence = wordCount > 0 ? Math.min(1, wordCount / 5) : 0.3

  return {
    score: normalizedScore,
    label: getLabel(normalizedScore),
    confidence,
    emotions: detectEmotions(text),
  }
}

/**
 * Analyze sentiment for a conversation (array of messages)
 */
export function analyzeConversationSentiment(
  messages: { role: string; content: string }[]
): SentimentResult {
  const userMessages = messages.filter((m) => m.role === 'user')
  if (userMessages.length === 0) {
    return { score: 0, label: 'neutral', confidence: 0, emotions: [] }
  }

  const sentiments = userMessages.map((m) => analyzeSentiment(m.content))
  const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length
  const avgConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length

  // Weight recent messages more heavily
  const recentWeight = 0.6
  const recentMessages = sentiments.slice(-Math.ceil(sentiments.length / 3))
  const recentScore = recentMessages.reduce((sum, s) => sum + s.score, 0) / recentMessages.length

  const weightedScore = avgScore * (1 - recentWeight) + recentScore * recentWeight

  // Merge emotions
  const emotionMap = new Map<string, number[]>()
  sentiments.forEach((s) => {
    s.emotions.forEach((e) => {
      if (!emotionMap.has(e.emotion)) emotionMap.set(e.emotion, [])
      emotionMap.get(e.emotion)!.push(e.score)
    })
  })

  const mergedEmotions: EmotionScore[] = Array.from(emotionMap.entries()).map(
    ([emotion, scores]) => ({
      emotion,
      score: scores.reduce((a, b) => a + b, 0) / scores.length,
    })
  )

  return {
    score: weightedScore,
    label: getLabel(weightedScore),
    confidence: avgConfidence,
    emotions: mergedEmotions.sort((a, b) => b.score - a.score),
  }
}

/**
 * Generate a conversation summary
 */
export function summarizeConversation(
  messages: { role: string; content: string; timestamp?: string }[]
): ConversationSummary {
  const sentiment = analyzeConversationSentiment(messages)

  // Extract key topics (simple keyword extraction)
  const allText = messages.map((m) => m.content).join(' ')
  const words = allText.toLowerCase().split(/\s+/)
  const wordFreq = new Map<string, number>()
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'to',
    'of',
    'and',
    'in',
    'that',
    'have',
    'has',
    'it',
    'for',
    'on',
    'with',
    'as',
    'this',
    'by',
    'from',
    'or',
    'but',
    'not',
    'at',
    'what',
    'how',
    'can',
    'do',
    'i',
    'you',
    'my',
    'your',
    'me',
    'we',
  ])

  words.forEach((word) => {
    const clean = word.replace(/[^a-z]/g, '')
    if (clean.length > 3 && !stopWords.has(clean)) {
      wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1)
    }
  })

  const keyTopics = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)

  // Determine resolution status
  const lastMessages = messages.slice(-3)
  const hasResolution = lastMessages.some(
    (m) =>
      m.content.toLowerCase().includes('resolved') ||
      m.content.toLowerCase().includes('solved') ||
      m.content.toLowerCase().includes('fixed') ||
      m.content.toLowerCase().includes('thank')
  )
  const hasEscalation = messages.some(
    (m) =>
      m.content.toLowerCase().includes('escalat') ||
      m.content.toLowerCase().includes('manager') ||
      m.content.toLowerCase().includes('supervisor')
  )

  const resolution = hasEscalation ? 'escalated' : hasResolution ? 'resolved' : 'unknown'

  // Calculate duration
  let duration = 0
  if (messages.length > 1 && messages[0].timestamp && messages[messages.length - 1].timestamp) {
    duration =
      (new Date(messages[messages.length - 1].timestamp!).getTime() -
        new Date(messages[0].timestamp!).getTime()) /
      1000
  }

  return {
    title:
      keyTopics.length > 0
        ? `Conversation about ${keyTopics.slice(0, 3).join(', ')}`
        : 'Conversation',
    summary: `${messages.length} messages exchanged. Overall sentiment: ${sentiment.label.replace('_', ' ')}.`,
    keyTopics,
    sentiment,
    messageCount: messages.length,
    duration,
    resolution,
  }
}

function getLabel(score: number): SentimentResult['label'] {
  if (score <= -0.6) return 'very_negative'
  if (score <= -0.2) return 'negative'
  if (score <= 0.2) return 'neutral'
  if (score <= 0.6) return 'positive'
  return 'very_positive'
}

function detectEmotions(text: string): EmotionScore[] {
  const lower = text.toLowerCase()
  const emotions: EmotionScore[] = []

  const emotionKeywords: Record<string, string[]> = {
    joy: ['happy', 'joy', 'excited', 'glad', 'delighted', 'pleased', 'wonderful', 'love', 'great'],
    anger: ['angry', 'furious', 'mad', 'annoyed', 'frustrated', 'outraged', 'unacceptable'],
    sadness: ['sad', 'unhappy', 'disappointed', 'upset', 'depressed', 'sorry', 'unfortunate'],
    fear: ['afraid', 'scared', 'worried', 'anxious', 'concerned', 'nervous', 'panic'],
    surprise: ['surprised', 'shocked', 'unexpected', 'amazing', 'wow', 'incredible'],
    trust: ['trust', 'reliable', 'confident', 'safe', 'secure', 'depend', 'faithful'],
  }

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length
    if (matchCount > 0) {
      emotions.push({
        emotion,
        score: Math.min(1, matchCount / 3),
      })
    }
  }

  return emotions.sort((a, b) => b.score - a.score)
}
