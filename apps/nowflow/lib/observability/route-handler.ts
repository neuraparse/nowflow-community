/**
 * Route-handler wrapper for App Router routes.
 *
 * `withTracedRoute(handler)` decorates a Next.js route handler so every
 * invocation runs inside a `withSpan('route:<METHOD> <pathname>', ...)`
 * scope. Exceptions thrown by the handler are auto-captured via
 * `captureException` (with route metadata as tags) and rethrown so Next.js
 * still produces a 500 response.
 *
 * The decorator is intentionally minimal — call sites should remain trivial:
 *
 *   export const GET = withTracedRoute(async (req) => { ... })
 *
 * It is type-preserving so handler signatures (Request | NextRequest, route
 * context with dynamic params) continue to work as-is.
 */
import { captureException, withSpan } from './index'

type RouteHandler<TArgs extends unknown[], TResult> = (
  req: Request,
  ...rest: TArgs
) => Promise<TResult> | TResult

const safePathname = (url: string): string => {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

/**
 * Wrap a route handler so it runs inside a tracing span and reports
 * exceptions to the observability layer.
 */
export function withTracedRoute<TArgs extends unknown[], TResult>(
  handler: RouteHandler<TArgs, TResult>
): (req: Request, ...rest: TArgs) => Promise<TResult> {
  return async (req, ...rest) => {
    const method = req.method ?? 'GET'
    const pathname = safePathname(req.url)
    const spanName = `route:${method} ${pathname}`
    return await withSpan(
      spanName,
      async (span) => {
        try {
          const result = await handler(req, ...rest)
          return result
        } catch (err) {
          span.recordException(err)
          captureException(err, {
            module: 'route-handler',
            tags: { method, route: pathname },
            level: 'error',
          })
          throw err
        }
      },
      { 'http.method': method, 'http.route': pathname }
    )
  }
}
