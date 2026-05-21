export interface AgentMetricsInput {
  workflowId: string
  executionId: string
  blockId: string
  agentName?: string | null
  agentProfileId?: string | null
  agentType: 'ai' | 'human'
  model?: string | null
  status: 'success' | 'failed' | 'timeout'
  durationMs?: number | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  cost?: number | null
  error?: string | null
  metadata?: Record<string, any> | null
}

/**
 * Community builds do not persist managed agent telemetry.
 * Keep the call site as a no-op so workflow execution stays compatible.
 */
export async function recordAgentMetrics(_data: AgentMetricsInput): Promise<void> {
  return
}
