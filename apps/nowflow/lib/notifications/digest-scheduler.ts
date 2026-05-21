import { render } from '@react-email/components'
import { Cron } from 'croner'
import { and, eq, gte, sql } from 'drizzle-orm'
import { DigestEmail } from '@/components/emails/digest-email'
import { APP_DOMAIN } from '@/lib/config/app-urls'
import { buildUnsubscribeHeaders } from '@/lib/email/unsubscribe-token'
import { createLogger } from '@/lib/logs/console-logger'
import { sendEmail } from '@/lib/mailer'
import { db } from '@/db'
import { user, userNotificationPreferences, workflow, workflowRun } from '@/db/schema'

const logger = createLogger('DigestScheduler')

interface WorkflowStats {
  name: string
  executionCount: number
}

interface RecentFailure {
  workflowName: string
  failureDate: Date
  errorMessage: string
}

interface DigestData {
  userId: string
  userEmail: string
  userName: string
  startDate: Date
  endDate: Date
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  pendingApprovals: number
  topWorkflows: WorkflowStats[]
  recentFailures: RecentFailure[]
}

/**
 * Aggregates workflow execution data for a user within a date range
 */
async function aggregateUserWorkflowData(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Omit<DigestData, 'userId' | 'userEmail' | 'userName'>> {
  try {
    // Get all workflows for the user
    const userWorkflows = await db
      .select({ id: workflow.id })
      .from(workflow)
      .where(eq(workflow.userId, userId))

    const workflowIds = userWorkflows.map((w: { id: string }) => w.id)

    if (workflowIds.length === 0) {
      return {
        startDate,
        endDate,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        pendingApprovals: 0,
        topWorkflows: [],
        recentFailures: [],
      }
    }

    // Get all workflow runs in the date range
    const runs = await db
      .select({
        id: workflowRun.id,
        workflowId: workflowRun.workflowId,
        status: workflowRun.status,
        error: workflowRun.error,
        completedAt: workflowRun.completedAt,
      })
      .from(workflowRun)
      .where(
        and(sql`${workflowRun.workflowId} IN ${workflowIds}`, gte(workflowRun.createdAt, startDate))
      )

    // Calculate statistics
    const totalExecutions = runs.length
    type RunRow = {
      id: string
      workflowId: string
      status: string
      error: string | null
      completedAt: Date | null
    }
    const successfulExecutions = runs.filter((r: RunRow) =>
      ['success', 'completed'].includes(r.status)
    ).length
    const failedExecutions = runs.filter((r: RunRow) =>
      ['failed', 'error'].includes(r.status)
    ).length

    // Count pending approvals (this would come from hitlRequest table)
    // For now, we'll set it to 0 as we don't have direct access pattern
    const pendingApprovals = 0

    // Get workflow names for aggregation
    const workflowMap = new Map<string, string>()
    const workflows = await db
      .select({ id: workflow.id, name: workflow.name })
      .from(workflow)
      .where(sql`${workflow.id} IN ${workflowIds}`)

    workflows.forEach((w: { id: string; name: string }) => {
      workflowMap.set(w.id, w.name)
    })

    // Aggregate top workflows by execution count
    const workflowExecutionCounts = new Map<string, number>()
    runs.forEach((run: RunRow) => {
      const count = workflowExecutionCounts.get(run.workflowId) || 0
      workflowExecutionCounts.set(run.workflowId, count + 1)
    })

    const topWorkflows: WorkflowStats[] = Array.from(workflowExecutionCounts.entries())
      .map(([workflowId, count]) => ({
        name: workflowMap.get(workflowId) || 'Unknown Workflow',
        executionCount: count,
      }))
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, 5) // Top 5 workflows

    // Get recent failures
    const recentFailures: RecentFailure[] = runs
      .filter((r: RunRow) => ['failed', 'error'].includes(r.status))
      .sort((a: RunRow, b: RunRow) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 5) // Top 5 recent failures
      .map((run: RunRow) => ({
        workflowName: workflowMap.get(run.workflowId) || 'Unknown Workflow',
        failureDate: run.completedAt ? new Date(run.completedAt) : new Date(),
        errorMessage: run.error || 'Unknown error',
      }))

    return {
      startDate,
      endDate,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      pendingApprovals,
      topWorkflows,
      recentFailures,
    }
  } catch (error) {
    logger.error('Error aggregating user workflow data', { userId, error })
    return {
      startDate,
      endDate,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      pendingApprovals: 0,
      topWorkflows: [],
      recentFailures: [],
    }
  }
}

/**
 * Sends digest email to a user
 */
async function sendDigestEmail(digestData: DigestData): Promise<boolean> {
  try {
    const baseUrl = APP_DOMAIN
    const dashboardLink = `${baseUrl}/dashboard`

    // Render email template
    const html = await render(
      DigestEmail({
        userName: digestData.userName,
        startDate: digestData.startDate,
        endDate: digestData.endDate,
        totalExecutions: digestData.totalExecutions,
        successfulExecutions: digestData.successfulExecutions,
        failedExecutions: digestData.failedExecutions,
        pendingApprovals: digestData.pendingApprovals,
        topWorkflows: digestData.topWorkflows,
        recentFailures: digestData.recentFailures,
        dashboardLink,
        userEmail: digestData.userEmail,
      })
    )

    // Send email with unsubscribe headers for Gmail compliance
    const emailResult = await sendEmail({
      to: digestData.userEmail,
      subject: 'Your NowFlow Workflow Activity Digest',
      html,
      headers: buildUnsubscribeHeaders(digestData.userId, 'digest'),
    })

    if (emailResult.success) {
      logger.info('Digest email sent successfully', {
        userId: digestData.userId,
        email: digestData.userEmail,
        totalExecutions: digestData.totalExecutions,
      })
      return true
    } else {
      logger.error('Failed to send digest email', {
        userId: digestData.userId,
        email: digestData.userEmail,
        error: emailResult.message,
      })
      return false
    }
  } catch (error: any) {
    const errorDetails = {
      message: error?.message || 'Unknown error',
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    }
    logger.error('Error sending digest email', {
      userId: digestData.userId,
      error: errorDetails,
    })
    return false
  }
}

/**
 * Processes daily digest emails for users
 */
export async function sendDailyDigests(): Promise<{ sent: number; failed: number }> {
  logger.info('Starting daily digest email processing')

  try {
    // Query users with digestEnabled=true and digestSchedule='daily'
    const usersToNotify = await db
      .select({
        userId: userNotificationPreferences.userId,
        userEmail: user.email,
        userName: user.name,
      })
      .from(userNotificationPreferences)
      .innerJoin(user, eq(user.id, userNotificationPreferences.userId))
      .where(
        and(
          eq(userNotificationPreferences.digestEnabled, true),
          eq(userNotificationPreferences.digestSchedule, 'daily')
        )
      )

    logger.info('Found users for daily digest', { count: usersToNotify.length })

    if (usersToNotify.length === 0) {
      return { sent: 0, failed: 0 }
    }

    // Calculate date range: last 24 hours
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)

    let sent = 0
    let failed = 0

    // Process each user
    for (const userInfo of usersToNotify) {
      try {
        // Aggregate workflow data for the user
        const data = await aggregateUserWorkflowData(userInfo.userId, startDate, endDate)

        // Only send digest if there's activity
        if (data.totalExecutions > 0 || data.pendingApprovals > 0) {
          const digestData: DigestData = {
            userId: userInfo.userId,
            userEmail: userInfo.userEmail,
            userName: userInfo.userName,
            ...data,
          }

          const success = await sendDigestEmail(digestData)
          if (success) {
            sent++
          } else {
            failed++
          }
        } else {
          logger.info('Skipping digest for user with no activity', {
            userId: userInfo.userId,
          })
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        logger.error('Error processing daily digest for user', {
          userId: userInfo.userId,
          error,
        })
        failed++
      }
    }

    logger.info('Daily digest processing completed', { sent, failed })
    return { sent, failed }
  } catch (error) {
    logger.error('Error in daily digest processing', { error })
    return { sent: 0, failed: 0 }
  }
}

/**
 * Processes weekly digest emails for users
 */
export async function sendWeeklyDigests(): Promise<{ sent: number; failed: number }> {
  logger.info('Starting weekly digest email processing')

  try {
    // Query users with digestEnabled=true and digestSchedule='weekly'
    const usersToNotify = await db
      .select({
        userId: userNotificationPreferences.userId,
        userEmail: user.email,
        userName: user.name,
      })
      .from(userNotificationPreferences)
      .innerJoin(user, eq(user.id, userNotificationPreferences.userId))
      .where(
        and(
          eq(userNotificationPreferences.digestEnabled, true),
          eq(userNotificationPreferences.digestSchedule, 'weekly')
        )
      )

    logger.info('Found users for weekly digest', { count: usersToNotify.length })

    if (usersToNotify.length === 0) {
      return { sent: 0, failed: 0 }
    }

    // Calculate date range: last 7 days
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)

    let sent = 0
    let failed = 0

    // Process each user
    for (const userInfo of usersToNotify) {
      try {
        // Aggregate workflow data for the user
        const data = await aggregateUserWorkflowData(userInfo.userId, startDate, endDate)

        // Only send digest if there's activity
        if (data.totalExecutions > 0 || data.pendingApprovals > 0) {
          const digestData: DigestData = {
            userId: userInfo.userId,
            userEmail: userInfo.userEmail,
            userName: userInfo.userName,
            ...data,
          }

          const success = await sendDigestEmail(digestData)
          if (success) {
            sent++
          } else {
            failed++
          }
        } else {
          logger.info('Skipping digest for user with no activity', {
            userId: userInfo.userId,
          })
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        logger.error('Error processing weekly digest for user', {
          userId: userInfo.userId,
          error,
        })
        failed++
      }
    }

    logger.info('Weekly digest processing completed', { sent, failed })
    return { sent, failed }
  } catch (error) {
    logger.error('Error in weekly digest processing', { error })
    return { sent: 0, failed: 0 }
  }
}

// Cron job instances
let dailyDigestCron: Cron | null = null
let weeklyDigestCron: Cron | null = null

/**
 * Initializes digest email schedulers
 */
export function initializeDigestSchedulers(): void {
  try {
    // Daily digest: Run at 8am UTC every day
    dailyDigestCron = new Cron(
      '0 8 * * *',
      {
        timezone: 'UTC',
        name: 'daily-digest',
      },
      async () => {
        logger.info('Daily digest cron job triggered')
        await sendDailyDigests()
      }
    )

    logger.info('Daily digest scheduler initialized', {
      schedule: '0 8 * * *',
      timezone: 'UTC',
      nextRun: dailyDigestCron.nextRun()?.toISOString(),
    })

    // Weekly digest: Run at 8am UTC every Monday
    weeklyDigestCron = new Cron(
      '0 8 * * 1',
      {
        timezone: 'UTC',
        name: 'weekly-digest',
      },
      async () => {
        logger.info('Weekly digest cron job triggered')
        await sendWeeklyDigests()
      }
    )

    logger.info('Weekly digest scheduler initialized', {
      schedule: '0 8 * * 1',
      timezone: 'UTC',
      nextRun: weeklyDigestCron.nextRun()?.toISOString(),
    })
  } catch (error) {
    logger.error('Error initializing digest schedulers', { error })
  }
}

/**
 * Stops all digest schedulers
 */
export function stopDigestSchedulers(): void {
  try {
    if (dailyDigestCron) {
      dailyDigestCron.stop()
      logger.info('Daily digest scheduler stopped')
    }

    if (weeklyDigestCron) {
      weeklyDigestCron.stop()
      logger.info('Weekly digest scheduler stopped')
    }
  } catch (error) {
    logger.error('Error stopping digest schedulers', { error })
  }
}
