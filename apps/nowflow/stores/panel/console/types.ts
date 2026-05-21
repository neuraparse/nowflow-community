export type ErrorCategory = 'validation' | 'network' | 'auth' | 'api' | 'runtime' | 'unknown'

export interface ErrorMetadata {
  code?: string
  type?: string
  category: ErrorCategory
  stack?: string
  context?: Record<string, any>
}

export interface ConsoleEntry {
  id: string
  output: any
  error?: string
  errorMetadata?: ErrorMetadata
  warning?: string
  durationMs: number
  startedAt: string
  endedAt: string
  workflowId: string | null
  timestamp: string
  blockName?: string
  blockType?: string
  blockId?: string
}

export interface ConsoleStatistics {
  total: number
  errors: number
  warnings: number
  success: number
  avgDuration: number
  totalDuration: number
}

export interface ConsoleFilterCriteria {
  workflowId?: string
  blockType?: string
  hasError?: boolean
  hasWarning?: boolean
  minDuration?: number
  maxDuration?: number
}

export interface ConsoleStore {
  entries: ConsoleEntry[]
  isOpen: boolean
  addConsole: (entry: Omit<ConsoleEntry, 'id' | 'timestamp'>) => ConsoleEntry
  clearConsole: (workflowId: string | null) => void
  getWorkflowEntries: (workflowId: string) => ConsoleEntry[]
  toggleConsole: () => void
  updateConsole: (
    entryId: string,
    updatedData: Partial<Omit<ConsoleEntry, 'id' | 'timestamp'>>
  ) => void
  searchEntries: (query: string, workflowId?: string) => ConsoleEntry[]
  filterEntries: (criteria: ConsoleFilterCriteria) => ConsoleEntry[]
  exportEntries: (workflowId?: string) => string
  getStatistics: (workflowId?: string) => ConsoleStatistics
}
