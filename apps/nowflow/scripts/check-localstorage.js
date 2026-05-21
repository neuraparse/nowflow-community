// Script to check localStorage for workflow data
// This should be run in the browser console

console.log('=== Checking localStorage for workflow data ===\n')

// Get all localStorage keys
const allKeys = Object.keys(localStorage)
console.log('All localStorage keys:', allKeys)

// Filter workflow-related keys
const workflowKeys = allKeys.filter(
  (key) =>
    key.startsWith('workflow-') ||
    key.startsWith('subblock-values-') ||
    key.includes('registry') ||
    key.includes('workflow')
)

console.log('\nWorkflow-related keys:', workflowKeys)

// Check registry
const registryKey = allKeys.find((key) => key.includes('registry'))
if (registryKey) {
  try {
    const registry = JSON.parse(localStorage.getItem(registryKey))
    console.log('\nRegistry data:', registry)

    if (registry && registry.workflows) {
      console.log('\nWorkflows in registry:')
      Object.keys(registry.workflows).forEach((id) => {
        const workflow = registry.workflows[id]
        console.log(`  - ${id} (${workflow.name}) - Workspace: ${workflow.workspaceId || 'null'}`)
      })
    }

    if (registry && registry.activeWorkflowId) {
      console.log(`\nActive workflow ID: ${registry.activeWorkflowId}`)
    }
  } catch (e) {
    console.error('Error parsing registry:', e)
  }
}

// Check individual workflow states
workflowKeys.forEach((key) => {
  if (key.startsWith('workflow-')) {
    const workflowId = key.replace('workflow-', '')
    try {
      const state = JSON.parse(localStorage.getItem(key))
      console.log(`\nWorkflow state for ${workflowId}:`, {
        hasBlocks: !!state.blocks,
        blockCount: state.blocks ? Object.keys(state.blocks).length : 0,
        hasEdges: !!state.edges,
        edgeCount: state.edges ? state.edges.length : 0,
        lastSaved: state.lastSaved ? new Date(state.lastSaved) : 'never',
      })
    } catch (e) {
      console.error(`Error parsing workflow state for ${workflowId}:`, e)
    }
  }
})

// Check for any polling intervals or timers
console.log('\n=== Checking for active intervals/timers ===')
console.log('This needs to be checked manually in the browser dev tools')

// Suggest cleanup
console.log('\n=== Cleanup suggestions ===')
console.log('To clean up stale workflow data, run:')
console.log('localStorage.clear() // WARNING: This will clear ALL localStorage data')
console.log('Or selectively remove workflow keys:')
workflowKeys.forEach((key) => {
  console.log(`localStorage.removeItem('${key}')`)
})
