import { eq, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { aiCreditAccount, aiCreditTransaction } from '@/db/schema'

// db is typed as `any` (see db/index.ts) so transaction's tx is also any

type DbTx = any

const logger = createLogger('CreditManager')

// Model pricing per 1K tokens (approximate in USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
  'gemini-pro': { input: 0.00025, output: 0.0005 },
  'groq-llama': { input: 0.0001, output: 0.0001 },
}

export interface CreditBalance {
  balance: number
  totalUsed: number
  totalPurchased: number
  freeCreditsUsed: number
  freeCreditsLimit: number
  byokEnabled: boolean
}

/**
 * Get or create credit account for user
 */
export async function getOrCreateAccount(userId: string): Promise<CreditBalance> {
  try {
    const [existing] = await db
      .select()
      .from(aiCreditAccount)
      .where(eq(aiCreditAccount.userId, userId))
      .limit(1)

    if (existing) {
      return {
        balance: parseFloat(existing.balance),
        totalUsed: parseFloat(existing.totalUsed),
        totalPurchased: parseFloat(existing.totalPurchased),
        freeCreditsUsed: parseFloat(existing.freeCreditsUsed),
        freeCreditsLimit: parseFloat(existing.freeCreditsLimit),
        byokEnabled: existing.byokEnabled,
      }
    }

    // Create new account with free credits — use ON CONFLICT to handle concurrent creation
    const accountId = crypto.randomUUID()
    const now = new Date()
    const [created] = await db
      .insert(aiCreditAccount)
      .values({
        id: accountId,
        userId,
        balance: '1.00', // $1 free credits
        freeCreditsLimit: '1.00',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: aiCreditAccount.userId })
      .returning()

    // If conflict occurred (another request created it first), fetch the existing record
    if (!created) {
      const [existing] = await db
        .select()
        .from(aiCreditAccount)
        .where(eq(aiCreditAccount.userId, userId))
        .limit(1)

      return {
        balance: parseFloat(existing.balance),
        totalUsed: parseFloat(existing.totalUsed),
        totalPurchased: parseFloat(existing.totalPurchased),
        freeCreditsUsed: parseFloat(existing.freeCreditsUsed),
        freeCreditsLimit: parseFloat(existing.freeCreditsLimit),
        byokEnabled: existing.byokEnabled,
      }
    }

    return {
      balance: 1.0,
      totalUsed: 0,
      totalPurchased: 0,
      freeCreditsUsed: 0,
      freeCreditsLimit: 1.0,
      byokEnabled: false,
    }
  } catch (error) {
    logger.error('Error getting credit account:', error)
    throw error
  }
}

/**
 * Check if user has enough credits for a model call
 */
export async function hasCredits(
  userId: string,
  estimatedTokens: number,
  model: string
): Promise<{ hasCredits: boolean; estimatedCost: number; balance: number }> {
  const account = await getOrCreateAccount(userId)
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini']
  const estimatedCost = (estimatedTokens / 1000) * ((pricing.input + pricing.output) / 2)

  return {
    hasCredits: account.byokEnabled || account.balance >= estimatedCost,
    estimatedCost,
    balance: account.balance,
  }
}

/**
 * Deduct credits for a model call
 */
export async function deductCredits(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  workflowId?: string,
  description?: string
): Promise<{ cost: number; remainingBalance: number }> {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini']
  const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output

  try {
    const result = await db.transaction(async (tx: DbTx) => {
      // Lock the row to prevent concurrent deductions (SELECT FOR UPDATE)
      const lockResult = await tx.execute(
        sql`SELECT * FROM ai_credit_account WHERE user_id = ${userId} LIMIT 1 FOR UPDATE`
      )
      const account = (lockResult as any)?.[0] ?? (lockResult as any)?.rows?.[0]

      if (!account) {
        throw new Error('Credit account not found')
      }

      if (account.byok_enabled) {
        return { cost: 0, remainingBalance: parseFloat(account.balance) }
      }

      // Use SQL arithmetic to avoid floating point errors and race conditions
      const [updated] = await tx
        .update(aiCreditAccount)
        .set({
          balance: sql`${aiCreditAccount.balance}::numeric - ${cost.toFixed(6)}::numeric`,
          totalUsed: sql`${aiCreditAccount.totalUsed}::numeric + ${cost.toFixed(6)}::numeric`,
          updatedAt: new Date(),
        })
        .where(eq(aiCreditAccount.userId, userId))
        .returning({ newBalance: aiCreditAccount.balance })

      await tx.insert(aiCreditTransaction).values({
        id: crypto.randomUUID(),
        accountId: account.id,
        type: 'usage',
        amount: (-cost).toFixed(6),
        model,
        tokensUsed: inputTokens + outputTokens,
        workflowId: workflowId || null,
        description: description || `${model} - ${inputTokens + outputTokens} tokens`,
        createdAt: new Date(),
      })

      return { cost, remainingBalance: parseFloat(updated.newBalance) }
    })

    return result
  } catch (error) {
    logger.error('Error deducting credits:', error)
    throw error
  }
}

/**
 * Add credits to user account (purchase or grant)
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: 'purchase' | 'free_grant' | 'refund',
  description?: string
): Promise<{ newBalance: number }> {
  try {
    const account = await getOrCreateAccount(userId)

    await db.transaction(async (tx: DbTx) => {
      const [acc] = await tx
        .select()
        .from(aiCreditAccount)
        .where(eq(aiCreditAccount.userId, userId))
        .limit(1)

      if (!acc) throw new Error('Account not found')

      const updates: Record<string, any> = {
        balance: sql`${aiCreditAccount.balance}::numeric + ${amount.toFixed(6)}::numeric`,
        updatedAt: new Date(),
      }

      if (type === 'purchase') {
        updates.totalPurchased = sql`${aiCreditAccount.totalPurchased}::numeric + ${amount.toFixed(6)}::numeric`
      }

      await tx.update(aiCreditAccount).set(updates).where(eq(aiCreditAccount.userId, userId))

      await tx.insert(aiCreditTransaction).values({
        id: crypto.randomUUID(),
        accountId: acc.id,
        type,
        amount: amount.toFixed(6),
        description: description || `${type}: $${amount.toFixed(2)}`,
        createdAt: new Date(),
      })
    })

    return { newBalance: account.balance + amount }
  } catch (error) {
    logger.error('Error adding credits:', error)
    throw error
  }
}

/**
 * Get credit usage history
 */
export async function getCreditHistory(userId: string, limit: number = 50): Promise<any[]> {
  try {
    const [account] = await db
      .select()
      .from(aiCreditAccount)
      .where(eq(aiCreditAccount.userId, userId))
      .limit(1)

    if (!account) return []

    const transactions = await db
      .select()
      .from(aiCreditTransaction)
      .where(eq(aiCreditTransaction.accountId, account.id))
      .orderBy(sql`${aiCreditTransaction.createdAt} DESC`)
      .limit(limit)

    return transactions
  } catch (error) {
    logger.error('Error getting credit history:', error)
    throw error
  }
}
