/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import '@testing-library/jest-dom'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WorkflowMetadata } from '@/stores/workflows/registry/types'
import { WorkflowList } from '@/app/w/components/sidebar/components/workflow-list/workflow-list'

const mocks = vi.hoisted(() => ({
  pathname: '/w/wf-1',
  updateWorkflow: vi.fn(),
  registryState: {
    activeWorkspaceId: 'workspace-1',
    activeWorkflowId: 'wf-1',
    isLoadingWorkflow: false,
    updateWorkflow: vi.fn(),
  },
  sessionState: {
    data: { user: { id: 'user-1' } },
    isPending: false,
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : (href?.pathname ?? '')} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/auth-client', () => ({
  useSession: () => mocks.sessionState,
}))

vi.mock('@/lib/logs/console-logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
  }),
}))

vi.mock('@/stores/workflows/registry/store', () => ({
  useWorkflowRegistry: () => mocks.registryState,
}))

vi.mock('@/components/workflow-icon-picker', () => ({
  WorkflowIconPicker: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}))

vi.mock('@/components/workflow-icons', () => ({
  getWorkflowIconById: () => ({
    color: '#4A7A68',
    icon: (props: any) => <svg aria-hidden="true" {...props} />,
  }),
  suggestWorkflowIcon: () => ({
    color: '#4A7A68',
    icon: (props: any) => <svg aria-hidden="true" {...props} />,
  }),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}))

vi.mock('@/components/ui/loading-agent', () => ({
  LoadingAgent: () => <span aria-label="loading" />,
}))

function workflow(
  id: string,
  name: string,
  description = '',
  day = 1,
  overrides: Partial<WorkflowMetadata> = {}
): WorkflowMetadata {
  return {
    id,
    name,
    description,
    color: '#4A7A68',
    icon: 'agent',
    workspaceId: 'workspace-1',
    marketplaceData: null,
    lastModified: new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`),
    ...overrides,
  }
}

const workflows = [
  workflow('wf-1', 'Daily digest', 'Summarizes customer updates', 5),
  workflow('wf-2', 'Lead router', 'Routes inbound leads', 4),
  workflow('wf-3', 'Invoice audit', 'Checks invoices', 3),
  workflow('wf-4', 'Support triage', 'Prioritizes tickets', 2),
  workflow('wf-5', 'Revenue report', 'Builds weekly reporting', 1),
]

describe('WorkflowList UI flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pathname = '/w/wf-1'
    mocks.registryState.activeWorkspaceId = 'workspace-1'
    mocks.registryState.activeWorkflowId = 'wf-1'
    mocks.registryState.isLoadingWorkflow = false
    mocks.registryState.updateWorkflow = mocks.updateWorkflow
    mocks.sessionState.data = { user: { id: 'user-1' } }
  })

  afterEach(() => {
    cleanup()
  })

  it('shows the first four workflows and expands the rest on demand', async () => {
    const user = userEvent.setup()
    render(<WorkflowList regularWorkflows={workflows} />)

    expect(screen.getByText('Daily digest')).toBeInTheDocument()
    expect(screen.getByText('Support triage')).toBeInTheDocument()
    expect(screen.queryByText('Revenue report')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show 1 more/i }))

    expect(screen.getByText('Revenue report')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()
  })

  it('searches across workflow name and description regardless of the collapsed initial list', async () => {
    const user = userEvent.setup()
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.type(screen.getByPlaceholderText(/search workflows/i), 'weekly')

    expect(screen.getByText('Revenue report')).toBeInTheDocument()
    expect(screen.queryByText('Daily digest')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument()
  })

  it('renders only the search-empty state when a query has no matches', async () => {
    const user = userEvent.setup()
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.type(screen.getByPlaceholderText(/search workflows/i), 'does-not-exist')

    expect(screen.getByText('No matching workflows')).toBeInTheDocument()
    expect(screen.getByText('Try a different search term')).toBeInTheDocument()
    expect(screen.queryByText('No workflows found')).not.toBeInTheDocument()
    expect(screen.queryByText('Create a new workflow to get started.')).not.toBeInTheDocument()
  })

  it('clears the active workflow search without disturbing the list', async () => {
    const user = userEvent.setup()
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.type(screen.getByLabelText(/search workflows/i), 'weekly')
    expect(screen.getByText('Revenue report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear workflow search/i }))

    expect(screen.getByLabelText(/search workflows/i)).toHaveValue('')
    expect(screen.getByText('Daily digest')).toBeInTheDocument()
    expect(screen.queryByText('Revenue report')).not.toBeInTheDocument()
  })

  it('renames an owned workflow from the list with keyboard confirmation', async () => {
    const user = userEvent.setup()
    mocks.updateWorkflow.mockResolvedValueOnce(undefined)
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.click(screen.getByRole('button', { name: /rename daily digest/i }))

    const renameInput = screen.getByDisplayValue('Daily digest')
    await user.clear(renameInput)
    await user.type(renameInput, 'Daily briefing{Enter}')

    expect(mocks.updateWorkflow).toHaveBeenCalledWith('wf-1', {
      name: 'Daily briefing',
    })
  })

  it('trims workflow names and saves rename on blur', async () => {
    const user = userEvent.setup()
    mocks.updateWorkflow.mockResolvedValueOnce(undefined)
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.click(screen.getByRole('button', { name: /rename daily digest/i }))

    const renameInput = screen.getByDisplayValue('Daily digest')
    await user.clear(renameInput)
    await user.type(renameInput, '  Daily briefing  ')
    await user.tab()

    expect(mocks.updateWorkflow).toHaveBeenCalledWith('wf-1', {
      name: 'Daily briefing',
    })
  })

  it('cancels rename with Escape and keeps the original workflow name', async () => {
    const user = userEvent.setup()
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.click(screen.getByRole('button', { name: /rename daily digest/i }))

    const renameInput = screen.getByDisplayValue('Daily digest')
    await user.clear(renameInput)
    await user.type(renameInput, 'Draft name{Escape}')

    expect(mocks.updateWorkflow).not.toHaveBeenCalled()
    expect(screen.getByText('Daily digest')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Draft name')).not.toBeInTheDocument()
  })

  it('reverts the inline editor when rename persistence fails', async () => {
    const user = userEvent.setup()
    mocks.updateWorkflow.mockRejectedValueOnce(new Error('save failed'))
    render(<WorkflowList regularWorkflows={workflows} />)

    await user.click(screen.getByRole('button', { name: /rename daily digest/i }))

    const renameInput = screen.getByDisplayValue('Daily digest')
    await user.clear(renameInput)
    await user.type(renameInput, 'Broken name{Enter}')

    expect(mocks.updateWorkflow).toHaveBeenCalledWith('wf-1', {
      name: 'Broken name',
    })
    expect(await screen.findByText('Daily digest')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Broken name')).not.toBeInTheDocument()
  })

  it('does not expose rename actions for shared workflows', () => {
    render(
      <WorkflowList
        regularWorkflows={[
          workflow('shared-1', 'Shared support flow', 'View-only collaboration', 6, {
            isShared: true,
            role: 'viewer',
          }),
        ]}
      />
    )

    expect(screen.getByText('Shared support flow')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rename shared support flow/i })).toBeNull()
  })

  it('shows loading and creating states without allowing search edits during loading', () => {
    const { rerender } = render(<WorkflowList regularWorkflows={workflows} isLoading />)

    expect(screen.getByLabelText(/search workflows/i)).toBeDisabled()
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument()
    expect(screen.queryByText('Daily digest')).not.toBeInTheDocument()

    rerender(<WorkflowList regularWorkflows={workflows.slice(0, 1)} isCreating />)

    expect(screen.getByText('Creating workflow...')).toBeInTheDocument()
    expect(screen.getByText('Daily digest')).toBeInTheDocument()
  })

  it('keeps collapsed mode compact by hiding search and workflow labels', () => {
    render(<WorkflowList regularWorkflows={workflows} isCollapsed />)

    expect(screen.queryByLabelText(/search workflows/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Daily digest')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show 1 more/i })).not.toBeInTheDocument()
  })

  it('renders the create-workflow empty state only when there are no workflows and no search', () => {
    render(<WorkflowList regularWorkflows={[]} />)

    const emptyState = screen.getByText('No workflows found').closest('div')
    expect(emptyState).toBeInTheDocument()
    expect(
      within(emptyState as HTMLElement).getByText('Create a new workflow to get started.')
    ).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/search workflows/i)).not.toBeInTheDocument()
  })
})
