/**
 * Minimal HTTP surface the executor relies on. A thin wrapper over `fetch`
 * so hosts can inject retries, timeouts, proxy config, observability, or
 * record/replay for tests.
 */
export interface HttpRequest {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string | Uint8Array | null
  signal?: AbortSignal
  timeoutMs?: number
}

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: string
  ok: boolean
}

export interface HttpProvider {
  request(req: HttpRequest): Promise<HttpResponse>
}
