export function isAbortLikeError(error: unknown, signal?: AbortSignal | null) {
  if (signal?.aborted) return true

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }

  if (error instanceof Error) {
    return (
      error.name === 'AbortError' ||
      error.message === 'Failed to fetch' ||
      error.message.toLowerCase() === 'aborted' ||
      error.message.toLowerCase().includes('operation was aborted')
    )
  }

  return false
}
