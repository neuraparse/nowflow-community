export interface General {
  isAutoConnectEnabled: boolean
  isDebugModeEnabled: boolean
  isAutoFillEnvVarsEnabled: boolean
  isLiveValidationEnabled: boolean
  theme: 'system' | 'light' | 'dark'
  isLoading: boolean
  error: string | null
}

export interface GeneralActions {
  toggleAutoConnect: () => void
  toggleDebugMode: () => void
  toggleAutoFillEnvVars: () => void
  toggleLiveValidation: () => void
  setTheme: (theme: 'system' | 'light' | 'dark') => void
  toggleTheme: () => void
  loadSettings: (force?: boolean) => Promise<void>
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>
}

export type GeneralStore = General & GeneralActions

export type UserSettings = {
  theme: 'system' | 'light' | 'dark'
  debugMode: boolean
  autoConnect: boolean
  autoFillEnvVars: boolean
}
