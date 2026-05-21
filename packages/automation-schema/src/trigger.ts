import { z } from 'zod'

/**
 * L2 TriggerConfig contract.
 *
 * Discriminated union on `kind`. Triggers are the entry-point primitives that
 * cause a workflow to execute: inbound HTTP (`webhook`), cron (`schedule`), or
 * a periodic pull from an external provider (`poll`). All variants share the
 * identity/ownership fields on the envelope.
 */
export const WebhookRateLimitSchema = z.object({
  perMinute: z.number(),
  perHour: z.number(),
})
export type WebhookRateLimit = z.infer<typeof WebhookRateLimitSchema>

export const WebhookTriggerSchema = z.object({
  kind: z.literal('webhook'),
  path: z.string(),
  signatureSecret: z.string().optional(),
  provider: z.string().optional(),
  rateLimit: WebhookRateLimitSchema.optional(),
})
export type WebhookTrigger = z.infer<typeof WebhookTriggerSchema>

export const ScheduleTriggerSchema = z.object({
  kind: z.literal('schedule'),
  cronExpression: z.string(),
  timezone: z.string(),
  startAt: z.string().optional(),
})
export type ScheduleTrigger = z.infer<typeof ScheduleTriggerSchema>

export const PollTriggerSchema = z.object({
  kind: z.literal('poll'),
  pollingIntervalSec: z.number(),
  provider: z.string(),
  providerConfig: z.record(z.string(), z.unknown()),
  lastSeenIdentifiers: z.array(z.string()).optional(),
})
export type PollTrigger = z.infer<typeof PollTriggerSchema>

/**
 * TriggerConfigSchema — the discriminated union of trigger variants plus the
 * shared envelope fields.
 */
export const TriggerConfigSchema = z.intersection(
  z.object({
    id: z.string(),
    workflowId: z.string(),
    isActive: z.boolean(),
    workspaceId: z.string(),
  }),
  z.discriminatedUnion('kind', [WebhookTriggerSchema, ScheduleTriggerSchema, PollTriggerSchema])
)
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>
