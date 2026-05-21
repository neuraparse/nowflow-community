export interface OllamaStore {
  models: string[]
  isLoading: boolean
  lastRefreshed: number
  setModels: (models: string[]) => void
  refreshModels: () => Promise<string[]>
  refreshIfNeeded: () => Promise<string[]>
}
