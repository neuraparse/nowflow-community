/**
 * Subscription Tier Limits Configuration
 * DEPRECATED: Limits are now fetched from the database subscription_plan table
 * This file is kept for backward compatibility and fallback values
 */

export type SubscriptionTier = 'free' | 'starter' | 'mid' | 'pro' | 'team' | 'enterprise'

export interface SubscriptionLimits {
  workflowLimit: number
  apiCallsLimit: number // per day
  storageLimit: number // in MB
  costLimit: number // in USD
  sharingEnabled: boolean
  multiplayerEnabled: boolean
  workspaceCollaborationEnabled: boolean
}

/**
 * Fallback tier-based limits configuration
 * These are used only when database is unavailable
 * For production, all limits should come from the database
 */
export const TIER_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    workflowLimit: 3,
    apiCallsLimit: 20,
    storageLimit: 50, // 50 MB
    costLimit: 5,
    sharingEnabled: false,
    multiplayerEnabled: false,
    workspaceCollaborationEnabled: false,
  },
  starter: {
    workflowLimit: 5,
    apiCallsLimit: 100,
    storageLimit: 256, // 256 MB
    costLimit: 10,
    sharingEnabled: false,
    multiplayerEnabled: false,
    workspaceCollaborationEnabled: false,
  },
  mid: {
    workflowLimit: 15,
    apiCallsLimit: 500,
    storageLimit: 1024, // 1 GB
    costLimit: 20,
    sharingEnabled: true,
    multiplayerEnabled: false,
    workspaceCollaborationEnabled: false,
  },
  pro: {
    workflowLimit: 50,
    apiCallsLimit: 2000,
    storageLimit: 5120, // 5 GB
    costLimit: 40,
    sharingEnabled: true,
    multiplayerEnabled: false,
    workspaceCollaborationEnabled: false,
  },
  team: {
    workflowLimit: 200,
    apiCallsLimit: 10000,
    storageLimit: 20480, // 20 GB per seat
    costLimit: 40,
    sharingEnabled: true,
    multiplayerEnabled: true,
    workspaceCollaborationEnabled: true,
  },
  enterprise: {
    workflowLimit: 999999,
    apiCallsLimit: 999999,
    storageLimit: 999999,
    costLimit: 999999,
    sharingEnabled: true,
    multiplayerEnabled: true,
    workspaceCollaborationEnabled: true,
  },
}

/**
 * Get limits for a specific tier (FALLBACK ONLY)
 * In production, use database subscription_plan table instead
 */
export function getTierLimits(tier: SubscriptionTier): SubscriptionLimits {
  return TIER_LIMITS[tier]
}

/**
 * Get default tier (free) limits (FALLBACK ONLY)
 */
export function getDefaultLimits(): SubscriptionLimits {
  return getTierLimits('free')
}

/**
 * Format storage size for display
 */
export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format API calls for display
 */
export function formatApiCalls(calls: number): string {
  if (calls >= 1000000) {
    return (calls / 1000000).toFixed(1) + 'M'
  }
  if (calls >= 1000) {
    return (calls / 1000).toFixed(1) + 'K'
  }
  return calls.toString()
}
