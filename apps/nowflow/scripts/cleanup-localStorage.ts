import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createLogger } from '@/lib/logs/console-logger'
import { workflow } from '../db/schema'

const logger = createLogger('cleanup-localStorage')

// Database connection
const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString, { prepare: false })
const db = drizzle(client)

async function cleanupLocalStorage() {
  logger.debug('🧹 Starting localStorage cleanup...\n')

  try {
    // Get all workflows from database
    const dbWorkflows = await db.select({ id: workflow.id }).from(workflow)
    const validWorkflowIds = dbWorkflows.map((w) => w.id)

    logger.debug(`📊 Found ${validWorkflowIds.length} valid workflows in database:`)
    validWorkflowIds.forEach((id) => logger.debug(`  - ${id}`))
    logger.debug('')

    // Generate cleanup script for browser console
    const cleanupScript = `
// 🧹 NowFlow localStorage Cleanup Script
// Run this in your browser console to clean up stale workflow data

logger.debug('🧹 Starting localStorage cleanup...');

// Valid workflow IDs from database
const validWorkflowIds = ${JSON.stringify(validWorkflowIds, null, 2)};

// Get all localStorage keys
const allKeys = Object.keys(localStorage);
logger.debug('📊 Total localStorage keys:', allKeys.length);

// Find workflow-related keys
const workflowKeys = allKeys.filter(key =>
  key.startsWith('workflow-') ||
  key.startsWith('subblock-values-')
);

logger.debug('Found', workflowKeys.length, 'workflow-related keys');

// Check which ones are stale
const staleKeys = [];
workflowKeys.forEach(key => {
  let workflowId;
  if (key.startsWith('workflow-')) {
    workflowId = key.replace('workflow-', '');
  } else if (key.startsWith('subblock-values-')) {
    workflowId = key.replace('subblock-values-', '');
  }

  if (workflowId && !validWorkflowIds.includes(workflowId)) {
    staleKeys.push(key);
  }
});

logger.debug('🗑️ Found', staleKeys.length, 'stale keys to remove:');
staleKeys.forEach(key => logger.debug('  -', key));

if (staleKeys.length === 0) {
  logger.debug('No cleanup needed - all workflow data is valid!');
} else {
  logger.debug('\\n🚨 Ready to clean up', staleKeys.length, 'stale entries');
  logger.debug('Run the following to proceed with cleanup:');
  logger.debug('');

  staleKeys.forEach(key => {
    logger.debug(\`localStorage.removeItem('\${key}');\`);
  });

  logger.debug('');
  logger.debug('Or run this to clean all at once:');
  logger.debug(\`
// Clean up all stale workflow data
\${staleKeys.map(key => \`localStorage.removeItem('\${key}');\`).join('\\n')}
logger.debug('Cleanup complete!');
  \`);
}

logger.debug('\\nNote: After cleanup, refresh the page to reload clean data from the database.');
`

    // Write cleanup script to file
    const fs = await import('fs')
    const path = await import('path')

    const scriptPath = path.join(process.cwd(), 'cleanup-localStorage.js')
    fs.writeFileSync(scriptPath, cleanupScript)

    logger.debug('Cleanup script generated!')
    logger.debug(`📁 Script saved to: ${scriptPath}`)
    logger.debug('')
    logger.debug('To use:')
    logger.debug('1. Open your browser and go to your NowFlow app')
    logger.debug('2. Open Developer Tools (F12)')
    logger.debug('3. Go to Console tab')
    logger.debug('4. Copy and paste the script from the generated file')
    logger.debug('5. Press Enter to run')
    logger.debug('')
    logger.debug('⚠️  Alternative: You can also run this directly in console:')
    logger.debug('localStorage.clear() // WARNING: This clears ALL localStorage data')
  } catch (error) {
    logger.error('Error during cleanup:', error)
  } finally {
    await client.end()
  }
}

cleanupLocalStorage().catch(console.error)
