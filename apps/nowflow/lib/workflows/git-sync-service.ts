import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workflowGitConfig, workflowVersion } from '@/db/schema'
import { createVersion } from './version-service'

const logger = createLogger('GitSyncService')

export interface GitConfig {
  repositoryUrl: string
  branch: string
  filePath: string
  authType: 'token' | 'ssh' | 'oauth'
  credentials: {
    token?: string
    privateKey?: string
    oauthToken?: string
  }
  autoSync: boolean
  syncOnDeploy: boolean
}

export interface GitSyncResult {
  success: boolean
  message: string
  commitSha?: string
  error?: string
}

/**
 * Gets Git configuration for a workflow
 */
export async function getGitConfig(workflowId: string): Promise<GitConfig | null> {
  try {
    const [config] = await db
      .select()
      .from(workflowGitConfig)
      .where(eq(workflowGitConfig.workflowId, workflowId))
      .limit(1)

    if (!config || !config.enabled) {
      return null
    }

    return {
      repositoryUrl: config.repositoryUrl || '',
      branch: config.branch || 'main',
      filePath: config.filePath || '',
      authType: config.authType as GitConfig['authType'],
      credentials: (config.credentials as GitConfig['credentials']) || {},
      autoSync: config.autoSync,
      syncOnDeploy: config.syncOnDeploy,
    }
  } catch (error) {
    logger.error('Failed to get Git config', { workflowId, error })
    throw error
  }
}

/**
 * Saves Git configuration for a workflow
 */
export async function saveGitConfig(
  workflowId: string,
  config: Partial<GitConfig> & { enabled: boolean }
): Promise<void> {
  try {
    const existing = await getGitConfig(workflowId)
    const now = new Date()

    if (existing) {
      await db
        .update(workflowGitConfig)
        .set({
          enabled: config.enabled,
          repositoryUrl: config.repositoryUrl,
          branch: config.branch,
          filePath: config.filePath,
          authType: config.authType,
          credentials: config.credentials,
          autoSync: config.autoSync,
          syncOnDeploy: config.syncOnDeploy,
          updatedAt: now,
        })
        .where(eq(workflowGitConfig.workflowId, workflowId))
    } else {
      await db.insert(workflowGitConfig).values({
        id: uuidv4(),
        workflowId,
        enabled: config.enabled,
        repositoryUrl: config.repositoryUrl,
        branch: config.branch || 'main',
        filePath: config.filePath,
        authType: config.authType,
        credentials: config.credentials,
        autoSync: config.autoSync ?? false,
        syncOnDeploy: config.syncOnDeploy ?? true,
        createdAt: now,
        updatedAt: now,
      })
    }

    logger.info('Saved Git config', { workflowId, enabled: config.enabled })
  } catch (error) {
    logger.error('Failed to save Git config', { workflowId, error })
    throw error
  }
}

/**
 * Pushes workflow to Git repository
 */
export async function pushToGit(
  workflowId: string,
  userId?: string,
  commitMessage?: string
): Promise<GitSyncResult> {
  try {
    const config = await getGitConfig(workflowId)
    if (!config) {
      return { success: false, message: 'Git sync not configured', error: 'NO_CONFIG' }
    }

    // Get current workflow state
    const [currentWorkflow] = await db
      .select({ state: workflow.state, name: workflow.name })
      .from(workflow)
      .where(eq(workflow.id, workflowId))
      .limit(1)

    if (!currentWorkflow) {
      return { success: false, message: 'Workflow not found', error: 'NOT_FOUND' }
    }

    // Prepare workflow data for Git
    const workflowData = {
      name: currentWorkflow.name,
      state: currentWorkflow.state,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    }

    // Determine Git provider from URL
    const provider = detectGitProvider(config.repositoryUrl)

    // Push to Git based on provider
    let result: GitSyncResult

    switch (provider) {
      case 'github':
        result = await pushToGitHub(config, workflowData, commitMessage)
        break
      case 'gitlab':
        result = await pushToGitLab(config, workflowData, commitMessage)
        break
      case 'bitbucket':
        result = await pushToBitbucket(config, workflowData, commitMessage)
        break
      default:
        result = {
          success: false,
          message: 'Unsupported Git provider',
          error: 'UNSUPPORTED_PROVIDER',
        }
    }

    // Update sync status
    await db
      .update(workflowGitConfig)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: result.success ? 'success' : 'failed',
        lastSyncError: result.error || null,
        updatedAt: new Date(),
      })
      .where(eq(workflowGitConfig.workflowId, workflowId))

    // Create version with Git info if successful
    if (result.success && result.commitSha) {
      await createVersion({
        workflowId,
        userId,
        changeType: 'update',
        name: `Git sync`,
        description: commitMessage || 'Synced to Git repository',
        gitCommitSha: result.commitSha,
        gitBranch: config.branch,
      })
    }

    return result
  } catch (error) {
    logger.error('Failed to push to Git', { workflowId, error })
    return {
      success: false,
      message: 'Git push failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Pulls workflow from Git repository
 */
export async function pullFromGit(workflowId: string, userId?: string): Promise<GitSyncResult> {
  try {
    const config = await getGitConfig(workflowId)
    if (!config) {
      return { success: false, message: 'Git sync not configured', error: 'NO_CONFIG' }
    }

    // Determine Git provider
    const provider = detectGitProvider(config.repositoryUrl)

    // Pull from Git based on provider
    let result: { success: boolean; data?: any; commitSha?: string; error?: string }

    switch (provider) {
      case 'github':
        result = await pullFromGitHub(config)
        break
      case 'gitlab':
        result = await pullFromGitLab(config)
        break
      case 'bitbucket':
        result = await pullFromBitbucket(config)
        break
      default:
        return {
          success: false,
          message: 'Unsupported Git provider',
          error: 'UNSUPPORTED_PROVIDER',
        }
    }

    if (!result.success || !result.data) {
      return {
        success: false,
        message: 'Failed to pull from Git',
        error: result.error,
      }
    }

    // Update workflow with pulled state
    await db
      .update(workflow)
      .set({
        state: result.data.state,
        lastSynced: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflow.id, workflowId))

    // Create version recording the pull
    await createVersion({
      workflowId,
      userId,
      changeType: 'restore',
      name: `Pulled from Git`,
      description: `Synced from ${config.branch} branch`,
      gitCommitSha: result.commitSha,
      gitBranch: config.branch,
    })

    // Update sync status
    await db
      .update(workflowGitConfig)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(workflowGitConfig.workflowId, workflowId))

    return {
      success: true,
      message: 'Workflow pulled from Git',
      commitSha: result.commitSha,
    }
  } catch (error) {
    logger.error('Failed to pull from Git', { workflowId, error })
    return {
      success: false,
      message: 'Git pull failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Detects Git provider from repository URL
 */
function detectGitProvider(url: string): 'github' | 'gitlab' | 'bitbucket' | 'unknown' {
  if (url.includes('github.com')) return 'github'
  if (url.includes('gitlab.com') || url.includes('gitlab')) return 'gitlab'
  if (url.includes('bitbucket.org')) return 'bitbucket'
  return 'unknown'
}

/**
 * Parses repository URL to extract owner and repo
 */
function parseRepoUrl(url: string): { owner: string; repo: string } {
  // Handle HTTPS URLs
  const httpsMatch = url.match(
    /(?:https?:\/\/)?(?:www\.)?(?:github|gitlab|bitbucket)\.(?:com|org)\/([^\/]+)\/([^\/\.]+)/
  )
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  // Handle SSH URLs
  const sshMatch = url.match(/git@(?:github|gitlab|bitbucket)\.(?:com|org):([^\/]+)\/([^\/\.]+)/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }

  throw new Error('Invalid repository URL')
}

/**
 * Push to GitHub using GitHub API
 */
async function pushToGitHub(
  config: GitConfig,
  data: any,
  commitMessage?: string
): Promise<GitSyncResult> {
  try {
    const token = config.credentials.token || config.credentials.oauthToken
    if (!token) {
      return { success: false, message: 'No authentication token', error: 'NO_TOKEN' }
    }

    const { owner, repo } = parseRepoUrl(config.repositoryUrl)
    const filePath = config.filePath || 'workflow.json'
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')

    // Check if file exists
    let sha: string | undefined
    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${config.branch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )
      if (getResponse.ok) {
        const fileData = await getResponse.json()
        sha = fileData.sha
      }
    } catch (e) {
      // File doesn't exist, that's fine
    }

    // Create or update file
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage || 'Update workflow via NowFlow',
          content,
          branch: config.branch,
          ...(sha && { sha }),
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return { success: false, message: 'GitHub API error', error }
    }

    const result = await response.json()
    return {
      success: true,
      message: 'Pushed to GitHub',
      commitSha: result.commit?.sha,
    }
  } catch (error) {
    return {
      success: false,
      message: 'GitHub push failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Pull from GitHub using GitHub API
 */
async function pullFromGitHub(
  config: GitConfig
): Promise<{ success: boolean; data?: any; commitSha?: string; error?: string }> {
  try {
    const token = config.credentials.token || config.credentials.oauthToken
    if (!token) {
      return { success: false, error: 'NO_TOKEN' }
    }

    const { owner, repo } = parseRepoUrl(config.repositoryUrl)
    const filePath = config.filePath || 'workflow.json'

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const fileData = await response.json()
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8')
    const data = JSON.parse(content)

    // Get latest commit SHA
    const commitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    let commitSha: string | undefined
    if (commitResponse.ok) {
      const commitData = await commitResponse.json()
      commitSha = commitData.sha
    }

    return { success: true, data, commitSha }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Push to GitLab (stub - implement similar to GitHub)
 */
async function pushToGitLab(
  config: GitConfig,
  data: any,
  commitMessage?: string
): Promise<GitSyncResult> {
  // Implementation similar to GitHub but using GitLab API
  return { success: false, message: 'GitLab support coming soon', error: 'NOT_IMPLEMENTED' }
}

/**
 * Pull from GitLab (stub)
 */
async function pullFromGitLab(
  config: GitConfig
): Promise<{ success: boolean; data?: any; commitSha?: string; error?: string }> {
  return { success: false, error: 'NOT_IMPLEMENTED' }
}

/**
 * Push to Bitbucket (stub)
 */
async function pushToBitbucket(
  config: GitConfig,
  data: any,
  commitMessage?: string
): Promise<GitSyncResult> {
  return { success: false, message: 'Bitbucket support coming soon', error: 'NOT_IMPLEMENTED' }
}

/**
 * Pull from Bitbucket (stub)
 */
async function pullFromBitbucket(
  config: GitConfig
): Promise<{ success: boolean; data?: any; commitSha?: string; error?: string }> {
  return { success: false, error: 'NOT_IMPLEMENTED' }
}
