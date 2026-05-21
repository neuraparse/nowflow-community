import { CopilotWorkflowBridge } from '@/components/copilot/copilot-workflow-bridge'
import { ErrorBoundary } from './components/error'

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="workspace-stage overflow-hidden h-full">
      <ErrorBoundary>{children}</ErrorBoundary>
      <CopilotWorkflowBridge />
    </main>
  )
}
