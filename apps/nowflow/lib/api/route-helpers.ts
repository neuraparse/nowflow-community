import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import type { ZodError, ZodSchema } from 'zod'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { workflow, workspace, workspaceMember } from '@/db/schema'

const logger = createLogger('RouteHelper')

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionUser = {
  id: string
  email: string
  name: string
}

type Session = {
  user: SessionUser
}

/** Context provided to every authenticated route handler. */
export type RouteContext = {
  /** The validated session (always present inside `withAuth`). */
  session: Session
  /** Shortcut for `session.user.id`. */
  userId: string
  /** Parsed JSON body (populated for POST / PUT / PATCH / DELETE, `null` for GET / HEAD). */
  body: any
  /** Dynamic route params forwarded from Next.js (e.g. `{ id: '...' }`). */
  params?: Record<string, string>
}

/** Context for public (unauthenticated) routes – session is absent. */
export type PublicRouteContext = Omit<RouteContext, 'session' | 'userId'> & {
  session: Session | null
  userId: string | null
}

type AuthenticatedRouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>

type PublicRouteHandler = (req: NextRequest, ctx: PublicRouteContext) => Promise<NextResponse>

// ─── Helpers ─────────────────────────────────────────────────────────────────

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function parseBody(req: NextRequest): Promise<any> {
  if (!METHODS_WITH_BODY.has(req.method)) return null
  try {
    return await req.json()
  } catch {
    // Body may be empty or not JSON – that's fine, let the handler decide.
    return null
  }
}

// ─── Wrappers ────────────────────────────────────────────────────────────────

/**
 * Authenticated route wrapper.
 *
 * Handles:
 * 1. Session resolution via `getSession()`
 * 2. 401 response when the user is not authenticated
 * 3. JSON body parsing for mutating methods
 * 4. Top-level try / catch with a 500 response
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, { userId }) => {
 *   const rows = await db.select().from(table).where(eq(table.userId, userId))
 *   return NextResponse.json({ rows })
 * })
 * ```
 */
export function withAuth(handler: AuthenticatedRouteHandler) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const session = await getSession()
      if (!session?.user?.id) {
        return unauthorized()
      }

      const [body, params] = await Promise.all([
        parseBody(req),
        routeCtx?.params ?? Promise.resolve(undefined),
      ])

      return await handler(req, {
        session: session as Session,
        userId: session.user.id,
        body,
        params,
      })
    } catch (error) {
      logger.error('Unhandled route error', { method: req.method, url: req.url, error })
      return serverError()
    }
  }
}

/**
 * Public route wrapper (no auth required).
 *
 * Still resolves the session (so handlers can optionally use it) but does
 * **not** reject unauthenticated requests.
 *
 * Usage:
 * ```ts
 * export const GET = withHandler(async (req, { session }) => {
 *   // session may be null
 *   return NextResponse.json({ public: true })
 * })
 * ```
 */
export function withHandler(handler: PublicRouteHandler) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const session = await getSession()

      const [body, params] = await Promise.all([
        parseBody(req),
        routeCtx?.params ?? Promise.resolve(undefined),
      ])

      return await handler(req, {
        session: (session as Session) ?? null,
        userId: session?.user?.id ?? null,
        body,
        params,
      })
    } catch (error) {
      logger.error('Unhandled route error', { method: req.method, url: req.url, error })
      return serverError()
    }
  }
}

// ─── Standard error responses ────────────────────────────────────────────────

/** 401 Unauthorized */
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** 404 Not Found */
export function notFound(msg = 'Not found') {
  return NextResponse.json({ error: msg }, { status: 404 })
}

/** 400 Bad Request */
export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

/** 403 Forbidden */
export function forbidden(msg = 'Forbidden') {
  return NextResponse.json({ error: msg }, { status: 403 })
}

/** 409 Conflict */
export function conflict(msg = 'Conflict') {
  return NextResponse.json({ error: msg }, { status: 409 })
}

/** 500 Internal Server Error */
export function serverError(msg = 'Internal server error') {
  return NextResponse.json({ error: msg }, { status: 500 })
}

/** 429 Too Many Requests */
export function tooManyRequests(msg = 'Rate limit exceeded') {
  return NextResponse.json({ error: msg, code: 'RATE_LIMIT_EXCEEDED' }, { status: 429 })
}

// ─── Standardized success envelope ───────────────────────────────────────────

/** 200 OK with `{ data }` envelope. */
export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init)
}

/** 201 Created with `{ data }` envelope. */
export function apiCreated<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 })
}

/** 204 No Content. */
export function apiNoContent() {
  return new NextResponse(null, { status: 204 })
}

// ─── Body parsing with Zod validation ────────────────────────────────────────

/**
 * Parse and validate a request body against a Zod schema.
 * Returns either the parsed value or a `NextResponse` 400 ready to return.
 */
export async function parseJson<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T | NextResponse> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return validationError(result.error)
  }
  return result.data
}

/** Format a Zod error as a 400 response with field-level details. */
export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
    { status: 400 }
  )
}

// ─── Workspace + Workflow access ─────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export type WorkspaceRouteContext = RouteContext & {
  workspaceId: string
  role: WorkspaceRole
  isOwner: boolean
}

type WorkspaceRouteHandler = (req: NextRequest, ctx: WorkspaceRouteContext) => Promise<NextResponse>

type WorkspaceAccessResult = {
  ok: boolean
  reason?: 'not-found' | 'forbidden'
  role?: WorkspaceRole
  isOwner?: boolean
}

export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<WorkspaceAccessResult> {
  const rows = await db
    .select({
      ownerId: workspace.ownerId,
      memberRole: workspaceMember.role,
    })
    .from(workspace)
    .leftJoin(
      workspaceMember,
      and(eq(workspaceMember.workspaceId, workspace.id), eq(workspaceMember.userId, userId))
    )
    .where(eq(workspace.id, workspaceId))
    .limit(1)

  if (rows.length === 0) return { ok: false, reason: 'not-found' }
  const row = rows[0]
  const isOwner = row.ownerId === userId
  if (!isOwner && !row.memberRole) return { ok: false, reason: 'forbidden' }

  const role: WorkspaceRole = isOwner ? 'owner' : (row.memberRole as WorkspaceRole)
  return { ok: true, role, isOwner }
}

type WorkspaceAccessOptions = {
  source?:
    | 'param'
    | 'query'
    | 'body'
    | ((req: NextRequest, ctx: RouteContext) => string | null | Promise<string | null>)
  key?: string
  requireAdmin?: boolean
  requireOwner?: boolean
}

async function resolveWorkspaceId(
  req: NextRequest,
  ctx: RouteContext,
  opts: WorkspaceAccessOptions
): Promise<string | null> {
  const key = opts.key ?? 'workspaceId'
  const source = opts.source ?? 'param'
  if (typeof source === 'function') return source(req, ctx)
  if (source === 'param') return ctx.params?.[key] ?? null
  if (source === 'query') return new URL(req.url).searchParams.get(key)
  if (source === 'body') {
    const v = ctx.body && typeof ctx.body === 'object' ? ctx.body[key] : null
    return typeof v === 'string' ? v : null
  }
  return null
}

export function withWorkspaceAccess(
  handler: WorkspaceRouteHandler,
  opts: WorkspaceAccessOptions = {}
) {
  return withAuth(async (req, ctx) => {
    const workspaceId = await resolveWorkspaceId(req, ctx, opts)
    if (!workspaceId) return badRequest('Workspace ID is required')

    const access = await checkWorkspaceAccess(ctx.userId, workspaceId)
    if (!access.ok) {
      return access.reason === 'not-found' ? notFound('Workspace not found') : forbidden()
    }

    if (opts.requireOwner && !access.isOwner) return forbidden('Owner role required')
    if (opts.requireAdmin && access.role !== 'owner' && access.role !== 'admin') {
      return forbidden('Admin role required')
    }

    return handler(req, {
      ...ctx,
      workspaceId,
      role: access.role!,
      isOwner: access.isOwner!,
    })
  })
}

type WorkflowAccessResult = {
  ok: boolean
  reason?: 'not-found' | 'forbidden'
  workspaceId?: string
  isOwner?: boolean
}

export async function checkWorkflowAccess(
  userId: string,
  workflowId: string
): Promise<WorkflowAccessResult> {
  const rows = await db
    .select({
      workflowUserId: workflow.userId,
      workflowWorkspaceId: workflow.workspaceId,
      collaborators: workflow.collaborators,
      ownerId: workspace.ownerId,
      memberUserId: workspaceMember.userId,
    })
    .from(workflow)
    .leftJoin(workspace, eq(workspace.id, workflow.workspaceId))
    .leftJoin(
      workspaceMember,
      and(eq(workspaceMember.workspaceId, workflow.workspaceId), eq(workspaceMember.userId, userId))
    )
    .where(eq(workflow.id, workflowId))
    .limit(1)

  if (rows.length === 0) return { ok: false, reason: 'not-found' }
  const row = rows[0]
  const isOwner = row.workflowUserId === userId || row.ownerId === userId
  const isMember = row.memberUserId === userId
  const isCollaborator = isUserInCollaborators(row.collaborators, userId)
  if (!isOwner && !isMember && !isCollaborator) return { ok: false, reason: 'forbidden' }
  return { ok: true, workspaceId: row.workflowWorkspaceId ?? '', isOwner }
}

function isUserInCollaborators(stored: unknown, userId: string): boolean {
  if (!stored) return false
  let arr: unknown[]
  if (Array.isArray(stored)) arr = stored
  else if (typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored)
      arr = Array.isArray(parsed) ? parsed : []
    } catch {
      return false
    }
  } else {
    return false
  }
  return arr.some((entry) => {
    if (typeof entry === 'string') return entry === userId
    if (entry && typeof entry === 'object' && 'userId' in (entry as any)) {
      return (entry as any).userId === userId
    }
    return false
  })
}

type WorkflowAccessOptions = {
  paramKey?: string
}

export function withWorkflowAccess(
  handler: WorkspaceRouteHandler,
  opts: WorkflowAccessOptions = {}
) {
  const paramKey = opts.paramKey ?? 'id'
  return withAuth(async (req, ctx) => {
    const workflowId = ctx.params?.[paramKey]
    if (!workflowId) return badRequest('Workflow ID is required')

    const access = await checkWorkflowAccess(ctx.userId, workflowId)
    if (!access.ok) {
      return access.reason === 'not-found' ? notFound('Workflow not found') : forbidden()
    }

    return handler(req, {
      ...ctx,
      workspaceId: access.workspaceId!,
      role: access.isOwner ? 'owner' : 'member',
      isOwner: access.isOwner!,
    })
  })
}
