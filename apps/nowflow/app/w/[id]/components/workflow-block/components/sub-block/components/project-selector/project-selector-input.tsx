'use client'

import { useEffect, useState } from 'react'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'
import { SubBlockConfig } from '@/blocks/types'
import { JiraProjectInfo, JiraProjectSelector } from './components/jira-project-selector'

interface ProjectSelectorInputProps {
  blockId: string
  subBlock: SubBlockConfig
  disabled?: boolean
  onProjectSelect?: (projectId: string) => void
}

export function ProjectSelectorInput({
  blockId,
  subBlock,
  disabled = false,
  onProjectSelect,
}: ProjectSelectorInputProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projectInfo, setProjectInfo] = useState<JiraProjectInfo | null>(null)

  // Get provider-specific values
  const provider = subBlock.provider || 'jira'

  // For Jira, we need the domain (read at call time, no reactive subscription needed)
  const storeState = useSubBlockStore.getState()
  const domain = (storeState.getValue(blockId, 'domain') as string) || ''
  const credentials = (storeState.getValue(blockId, 'credential') as string) || ''

  // Get the current value from the store (read once on mount)
  useEffect(() => {
    const value = useSubBlockStore.getState().getValue(blockId, subBlock.id)
    if (value && typeof value === 'string') {
      setSelectedProjectId(value)
    }
  }, [blockId, subBlock.id])

  // Handle project selection
  const handleProjectChange = (projectId: string, info?: JiraProjectInfo) => {
    setSelectedProjectId(projectId)
    setProjectInfo(info || null)
    const s = useSubBlockStore.getState()
    s.setValue(blockId, subBlock.id, projectId)

    // Clear the issue-related fields when a new project is selected
    if (provider === 'jira') {
      s.setValue(blockId, 'summary', '')
      s.setValue(blockId, 'description', '')
      s.setValue(blockId, 'issueKey', '')
    }

    onProjectSelect?.(projectId)
  }

  return (
    <JiraProjectSelector
      value={selectedProjectId}
      onChange={handleProjectChange}
      domain={domain}
      provider="jira"
      requiredScopes={subBlock.requiredScopes || []}
      serviceId={subBlock.serviceId}
      label={subBlock.placeholder || 'Select Jira project'}
      disabled={disabled}
      showPreview={true}
      onProjectInfoChange={setProjectInfo}
    />
  )
}
