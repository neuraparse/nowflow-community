export interface Version {
  id: string
  versionNumber: number
  name: string | null
  description: string | null
  changeType: 'create' | 'update' | 'deploy' | 'restore' | 'auto_save'
  changeSummary: {
    blocksAdded?: number
    blocksRemoved?: number
    blocksModified?: number
    edgesAdded?: number
    edgesRemoved?: number
    summary?: string
  } | null
  createdBy: string
  createdAt: string
  semanticVersion: string | null
  majorVersion: number
  minorVersion: number
  patchVersion: number
  tags: string[]
  isPinned: boolean
  isLocked: boolean
  releaseNotes: string | null
  metadata: Record<string, any>
}

export interface DiffData {
  diff: {
    blocks: {
      added: Array<{ id: string; type: string; name?: string }>
      removed: Array<{ id: string; type: string; name?: string }>
      modified: Array<{
        id: string
        type: string
        name?: string
        changes: Array<{ path: string; from: any; to: any }>
      }>
    }
    edges: {
      added: Array<{ id: string; source: string; target: string }>
      removed: Array<{ id: string; source: string; target: string }>
    }
    loops: {
      added: string[]
      removed: string[]
      modified: string[]
    }
    metadata: {
      fromBlockCount: number
      toBlockCount: number
      fromEdgeCount: number
      toEdgeCount: number
    }
  }
  summary: string
  fromVersionData: Version
  toVersionData: Version
}

export interface VersionTag {
  name: string
  slug: string
  color: string
  description?: string
  isDefault?: boolean
}

export interface AutoSaveConfig {
  enabled: boolean
  intervalMinutes: number
  maxAutoSaveVersions: number
  significantChangeThreshold: number
}

export interface VersionHistoryPanelProps {
  workflowId: string
  panelWidth?: number
}
