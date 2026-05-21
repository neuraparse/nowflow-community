// 🧹 NowFlow localStorage Cleanup Script
// Run this in your browser console to clean up stale workflow data

console.log('🧹 Starting localStorage cleanup...')

// Valid workflow IDs from database
const validWorkflowIds = [
  '92f69ba1-b5e7-4e14-a73e-e0836353ab57',
  '0663a747-7c3c-43d9-86b5-4dad82ebfd1a',
]

// Get all localStorage keys
const allKeys = Object.keys(localStorage)
console.log('📊 Total localStorage keys:', allKeys.length)

// Find workflow-related keys
const workflowKeys = allKeys.filter(
  (key) => key.startsWith('workflow-') || key.startsWith('subblock-values-')
)

console.log('🔍 Found', workflowKeys.length, 'workflow-related keys')

// Check which ones are stale
const staleKeys = []
workflowKeys.forEach((key) => {
  let workflowId
  if (key.startsWith('workflow-')) {
    workflowId = key.replace('workflow-', '')
  } else if (key.startsWith('subblock-values-')) {
    workflowId = key.replace('subblock-values-', '')
  }

  if (workflowId && !validWorkflowIds.includes(workflowId)) {
    staleKeys.push(key)
  }
})

console.log('🗑️ Found', staleKeys.length, 'stale keys to remove:')
staleKeys.forEach((key) => console.log('  -', key))

if (staleKeys.length === 0) {
  console.log('✅ No cleanup needed - all workflow data is valid!')
} else {
  console.log('\n🚨 Ready to clean up', staleKeys.length, 'stale entries')
  console.log('Run the following to proceed with cleanup:')
  console.log('')

  staleKeys.forEach((key) => {
    console.log(`localStorage.removeItem('${key}');`)
  })

  console.log('')
  console.log('Or run this to clean all at once:')
  console.log(`
// Clean up all stale workflow data
${staleKeys.map((key) => `localStorage.removeItem('${key}');`).join('\n')}
console.log('✅ Cleanup complete!');
  `)
}

console.log('\n📝 Note: After cleanup, refresh the page to reload clean data from the database.')
