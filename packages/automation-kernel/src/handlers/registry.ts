import type { BlockHandler } from './types'

/**
 * Registry mapping `blockType` -> `BlockHandler`.
 *
 * Duplicate registrations throw to catch accidental overrides. The executor
 * looks up handlers by the block's declared type.
 */
export class HandlerRegistry {
  private handlers = new Map<string, BlockHandler>()

  register(handler: BlockHandler): void {
    const existing = this.handlers.get(handler.blockType)
    if (existing) {
      throw new Error(
        `HandlerRegistry: handler for blockType "${handler.blockType}" is already registered`
      )
    }
    this.handlers.set(handler.blockType, handler)
  }

  lookup(blockType: string): BlockHandler | undefined {
    return this.handlers.get(blockType)
  }

  list(): string[] {
    return Array.from(this.handlers.keys())
  }
}
