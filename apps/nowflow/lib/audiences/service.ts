import { and, asc, count, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  audienceContact,
  audienceMember,
  audience as audienceTable,
  subscription,
  subscriptionPlan,
  user,
  userStats,
} from '@/db/schema'

export type AudienceType = 'static' | 'dynamic'
export type AudienceSource = 'users' | 'contacts' | 'mixed'

export type AudienceRules = {
  source: 'users'
  match?: 'all' | 'any'
  filters?: {
    statuses?: string[]
    onlyVerified?: boolean
    planNames?: string[]
    createdWithinDays?: number
    lastActiveWithinDays?: number
  }
}

export type AudienceRecord = {
  id: string
  name: string
  description: string | null
  type: AudienceType
  source: AudienceSource
  rules: AudienceRules | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export type AudienceMemberRecord = {
  id: string
  type: 'user' | 'contact'
  email: string
  name: string | null
  status: string | null
  userId: string | null
  contactId: string | null
  createdAt: Date
}

const DAY_MS = 86_400_000

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeRules(raw: unknown): AudienceRules | null {
  if (!raw || typeof raw !== 'object') return null
  const rules = raw as AudienceRules
  if (rules.source !== 'users') return null

  const filters = rules.filters ?? {}
  const createdWithinDays =
    typeof filters.createdWithinDays === 'number'
      ? clampNumber(Math.floor(filters.createdWithinDays), 1, 3650)
      : undefined
  const lastActiveWithinDays =
    typeof filters.lastActiveWithinDays === 'number'
      ? clampNumber(Math.floor(filters.lastActiveWithinDays), 1, 3650)
      : undefined

  return {
    source: 'users',
    match: rules.match === 'any' ? 'any' : 'all',
    filters: {
      statuses: Array.isArray(filters.statuses) ? filters.statuses.filter(Boolean) : undefined,
      onlyVerified: typeof filters.onlyVerified === 'boolean' ? filters.onlyVerified : undefined,
      planNames: Array.isArray(filters.planNames) ? filters.planNames.filter(Boolean) : undefined,
      createdWithinDays,
      lastActiveWithinDays,
    },
  }
}

function resolveStatusFilter(statuses: string[] | undefined, includeInactive: boolean) {
  if (statuses && statuses.length) return statuses
  return includeInactive ? ['active', 'suspended'] : ['active']
}

function buildUserConditions(options: {
  rules?: AudienceRules | null
  onlyVerified?: boolean
  includeInactive?: boolean
}) {
  const rules = options.rules ? normalizeRules(options.rules) : null
  const filters = rules?.filters ?? {}
  const includeInactive = options.includeInactive ?? false
  const onlyVerified = filters.onlyVerified ?? options.onlyVerified ?? true

  const conditions = []
  const statusFilter = resolveStatusFilter(filters.statuses, includeInactive)
  conditions.push(inArray(user.status, statusFilter))

  if (onlyVerified) {
    conditions.push(eq(user.emailVerified, true))
  }

  if (filters.createdWithinDays) {
    const createdAfter = new Date(Date.now() - filters.createdWithinDays * DAY_MS)
    conditions.push(gte(user.createdAt, createdAfter))
  }

  if (filters.lastActiveWithinDays) {
    const lastActiveAfter = new Date(Date.now() - filters.lastActiveWithinDays * DAY_MS)
    conditions.push(gte(userStats.lastActive, lastActiveAfter))
  }

  if (filters.planNames && filters.planNames.length) {
    const planName = sql`coalesce(${subscriptionPlan.name}, 'free')`.mapWith(String)
    conditions.push(inArray(planName, filters.planNames))
  }

  return conditions
}

async function resolveUserEmailBatch(options: {
  rules?: AudienceRules | null
  onlyVerified?: boolean
  includeInactive?: boolean
  limit: number
  offset: number
}) {
  const conditions = buildUserConditions(options)

  const rows = await db
    .select({ email: user.email })
    .from(user)
    .leftJoin(subscription, eq(subscription.referenceId, user.id))
    .leftJoin(subscriptionPlan, eq(subscription.planId, subscriptionPlan.id))
    .leftJoin(userStats, eq(userStats.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(user.createdAt))
    .limit(options.limit)
    .offset(options.offset)

  return rows.map((row: { email: string | null }) => row.email)
}

async function resolveUserIdBatch(options: {
  rules?: AudienceRules | null
  includeInactive?: boolean
  limit?: number
  offset?: number
}) {
  const conditions = buildUserConditions({
    rules: options.rules,
    includeInactive: options.includeInactive,
    onlyVerified: false,
  })

  let query = db
    .select({ id: user.id })
    .from(user)
    .leftJoin(subscription, eq(subscription.referenceId, user.id))
    .leftJoin(subscriptionPlan, eq(subscription.planId, subscriptionPlan.id))
    .leftJoin(userStats, eq(userStats.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(user.createdAt))

  if (options.limit !== undefined) {
    query = query.limit(options.limit)
  }
  if (options.offset !== undefined) {
    query = query.offset(options.offset)
  }

  const rows = await query

  return rows.map((row: { id: string }) => row.id)
}

async function resolveStaticAudienceEmails(options: {
  audienceId: string
  limit: number
  offset: number
  onlyVerified?: boolean
  includeInactive?: boolean
  includeContacts?: boolean
}) {
  const includeContacts = options.includeContacts ?? true
  const onlyVerified = options.onlyVerified ?? true
  const includeInactive = options.includeInactive ?? false
  const statusFilter = resolveStatusFilter(undefined, includeInactive)

  const userConditions = [eq(audienceMember.memberType, 'user'), inArray(user.status, statusFilter)]
  if (onlyVerified) {
    userConditions.push(eq(user.emailVerified, true))
  }

  const recipientConditions = [and(...userConditions)]
  if (includeContacts) {
    recipientConditions.push(
      and(eq(audienceMember.memberType, 'contact'), eq(audienceContact.status, 'subscribed'))
    )
  }

  const rows = await db
    .select({
      memberType: audienceMember.memberType,
      userEmail: user.email,
      contactEmail: audienceContact.email,
    })
    .from(audienceMember)
    .leftJoin(user, eq(audienceMember.userId, user.id))
    .leftJoin(audienceContact, eq(audienceMember.contactId, audienceContact.id))
    .where(
      and(
        eq(audienceMember.audienceId, options.audienceId),
        recipientConditions.length > 1 ? or(...recipientConditions) : recipientConditions[0]
      )
    )
    .orderBy(asc(audienceMember.createdAt))
    .limit(options.limit)
    .offset(options.offset)

  const recipients = new Map<string, string>()

  for (const row of rows) {
    const email = row.memberType === 'user' ? row.userEmail : row.contactEmail
    if (!email) continue
    const key = email.toLowerCase()
    if (!recipients.has(key)) {
      recipients.set(key, email)
    }
  }

  return Array.from(recipients.values())
}

export async function getAudienceById(
  audienceId: string,
  options?: { includeArchived?: boolean }
): Promise<AudienceRecord | null> {
  const [row] = await db
    .select({
      id: audienceTable.id,
      name: audienceTable.name,
      description: audienceTable.description,
      type: audienceTable.type,
      source: audienceTable.source,
      rules: audienceTable.rules,
      isArchived: audienceTable.isArchived,
      createdAt: audienceTable.createdAt,
      updatedAt: audienceTable.updatedAt,
    })
    .from(audienceTable)
    .where(
      and(
        eq(audienceTable.id, audienceId),
        options?.includeArchived ? undefined : eq(audienceTable.isArchived, false)
      )
    )
    .limit(1)

  if (!row) return null

  return {
    ...row,
    type: (row.type as AudienceType) || 'static',
    source: (row.source as AudienceSource) || 'users',
    rules: normalizeRules(row.rules),
  }
}

export async function countAudienceRecipients(options: {
  audienceId: string
  onlyVerified?: boolean
  includeInactive?: boolean
  includeContacts?: boolean
}) {
  const audience = await getAudienceById(options.audienceId, { includeArchived: true })
  if (!audience) return 0

  if (audience.type === 'dynamic') {
    const conditions = buildUserConditions({
      rules: audience.rules,
      onlyVerified: options.onlyVerified,
      includeInactive: options.includeInactive,
    })

    const [row] = await db
      .select({ total: count() })
      .from(user)
      .leftJoin(subscription, eq(subscription.referenceId, user.id))
      .leftJoin(subscriptionPlan, eq(subscription.planId, subscriptionPlan.id))
      .leftJoin(userStats, eq(userStats.userId, user.id))
      .where(conditions.length ? and(...conditions) : undefined)

    return Number(row?.total || 0)
  }

  const includeContacts = options.includeContacts ?? true
  let total = 0

  const statusFilter = resolveStatusFilter(undefined, options.includeInactive ?? false)
  const userConditions = [
    eq(audienceMember.audienceId, options.audienceId),
    eq(audienceMember.memberType, 'user'),
    inArray(user.status, statusFilter),
  ]
  if (options.onlyVerified ?? true) {
    userConditions.push(eq(user.emailVerified, true))
  }

  const [userCount] = await db
    .select({ total: count(audienceMember.id) })
    .from(audienceMember)
    .innerJoin(user, eq(audienceMember.userId, user.id))
    .where(and(...userConditions))

  total += Number(userCount?.total || 0)

  if (includeContacts) {
    const [contactCount] = await db
      .select({ total: count(audienceMember.id) })
      .from(audienceMember)
      .innerJoin(audienceContact, eq(audienceMember.contactId, audienceContact.id))
      .where(
        and(
          eq(audienceMember.audienceId, options.audienceId),
          eq(audienceMember.memberType, 'contact'),
          eq(audienceContact.status, 'subscribed')
        )
      )

    total += Number(contactCount?.total || 0)
  }

  return total
}

export async function resolveAudienceEmailBatch(options: {
  audienceId?: string | null
  limit: number
  offset: number
  onlyVerified?: boolean
  includeInactive?: boolean
  includeContacts?: boolean
}) {
  if (!options.audienceId) {
    const recipients = await resolveUserEmailBatch(options)
    return { recipients }
  }

  const audience = await getAudienceById(options.audienceId, { includeArchived: true })
  if (!audience || audience.isArchived) {
    return { recipients: [] }
  }

  if (audience.type === 'dynamic') {
    const recipients = await resolveUserEmailBatch({
      rules: audience.rules,
      onlyVerified: options.onlyVerified,
      includeInactive: options.includeInactive,
      limit: options.limit,
      offset: options.offset,
    })
    return { recipients }
  }

  const recipients = await resolveStaticAudienceEmails({
    audienceId: options.audienceId,
    limit: options.limit,
    offset: options.offset,
    onlyVerified: options.onlyVerified,
    includeInactive: options.includeInactive,
    includeContacts: options.includeContacts,
  })

  return { recipients }
}

export async function resolveAudienceUserIds(options: {
  audienceId: string
  limit?: number
  offset?: number
  includeInactive?: boolean
}) {
  const audience = await getAudienceById(options.audienceId, { includeArchived: true })
  if (!audience || audience.isArchived) {
    return { userIds: [] }
  }

  if (audience.type === 'dynamic') {
    const userIds = await resolveUserIdBatch({
      rules: audience.rules,
      includeInactive: options.includeInactive,
      limit: options.limit,
      offset: options.offset,
    })
    return { userIds }
  }

  let query = db
    .select({
      userId: audienceMember.userId,
      userStatus: user.status,
    })
    .from(audienceMember)
    .leftJoin(user, eq(audienceMember.userId, user.id))
    .where(
      and(eq(audienceMember.audienceId, options.audienceId), eq(audienceMember.memberType, 'user'))
    )
    .orderBy(asc(audienceMember.createdAt))

  if (options.limit !== undefined) {
    query = query.limit(options.limit)
  }
  if (options.offset !== undefined) {
    query = query.offset(options.offset)
  }

  const rows = await query

  type UserRow = { userId: string | null; userStatus: string | null }
  const userIds = rows
    .filter((row: UserRow) => {
      if (!row.userId) return false
      if (row.userStatus === 'banned') return false
      if (!options.includeInactive && row.userStatus !== 'active') return false
      return true
    })
    .map((row: UserRow) => row.userId as string)

  return { userIds }
}

export async function listAudienceMembers(options: {
  audienceId: string
  limit: number
  offset: number
  search?: string | null
}) {
  const searchTerm = options.search?.trim()
  const searchQuery = searchTerm ? `%${searchTerm}%` : null
  const searchFilter = searchQuery
    ? or(
        and(
          eq(audienceMember.memberType, 'user'),
          or(ilike(user.email, searchQuery), ilike(user.name, searchQuery))
        ),
        and(
          eq(audienceMember.memberType, 'contact'),
          or(ilike(audienceContact.email, searchQuery), ilike(audienceContact.name, searchQuery))
        )
      )
    : undefined

  const rows = await db
    .select({
      id: audienceMember.id,
      memberType: audienceMember.memberType,
      userId: audienceMember.userId,
      contactId: audienceMember.contactId,
      userEmail: user.email,
      userName: user.name,
      userStatus: user.status,
      contactEmail: audienceContact.email,
      contactName: audienceContact.name,
      contactStatus: audienceContact.status,
      createdAt: audienceMember.createdAt,
    })
    .from(audienceMember)
    .leftJoin(user, eq(audienceMember.userId, user.id))
    .leftJoin(audienceContact, eq(audienceMember.contactId, audienceContact.id))
    .where(and(eq(audienceMember.audienceId, options.audienceId), searchFilter))
    .orderBy(asc(audienceMember.createdAt))
    .limit(options.limit)
    .offset(options.offset)

  type MemberRow = {
    id: string
    memberType: string
    userId: string | null
    contactId: string | null
    userEmail: string | null
    userName: string | null
    userStatus: string | null
    contactEmail: string | null
    contactName: string | null
    contactStatus: string | null
    createdAt: Date
  }
  const members: AudienceMemberRecord[] = rows.map((row: MemberRow) => {
    const isUser = row.memberType === 'user'
    const email = isUser ? row.userEmail : row.contactEmail
    const name = isUser ? row.userName : row.contactName
    const status = isUser ? row.userStatus : row.contactStatus
    return {
      id: row.id,
      type: isUser ? 'user' : 'contact',
      email: email || '',
      name: name || null,
      status: status || null,
      userId: row.userId || null,
      contactId: row.contactId || null,
      createdAt: row.createdAt,
    }
  })

  return members
}
