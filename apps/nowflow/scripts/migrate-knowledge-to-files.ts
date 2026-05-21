/**
 * Migration Script: Create file records from existing knowledge documents
 *
 * This script creates file table records for existing knowledge documents
 * that were uploaded before the file/knowledge separation.
 */
import { eq, isNotNull } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { db } from '@/db'
import { file, knowledgeDocument, knowledgeSource } from '@/db/schema'

const logger = createLogger('MigrateKnowledgeToFiles')

async function migrateKnowledgeDocumentsToFiles() {
  try {
    logger.info('Starting migration of knowledge documents to file table...')

    // Get all knowledge documents that are files and have a file path
    const documents = await db
      .select({
        id: knowledgeDocument.id,
        name: knowledgeDocument.name,
        filePath: knowledgeDocument.filePath,
        fileType: knowledgeDocument.fileType,
        fileSize: knowledgeDocument.fileSize,
        sourceId: knowledgeDocument.sourceId,
        createdAt: knowledgeDocument.createdAt,
      })
      .from(knowledgeDocument)
      .where(isNotNull(knowledgeDocument.filePath))

    logger.info(`Found ${documents.length} knowledge documents with files`)

    let created = 0
    let skipped = 0
    let errors = 0

    for (const doc of documents) {
      try {
        // Get the knowledge source to find userId and workspaceId
        const sources = await db
          .select({
            userId: knowledgeSource.userId,
            workspaceId: knowledgeSource.workspaceId,
          })
          .from(knowledgeSource)
          .where(eq(knowledgeSource.id, doc.sourceId))
          .limit(1)

        if (sources.length === 0) {
          logger.warn(`No source found for document ${doc.id}`)
          skipped++
          continue
        }

        const source = sources[0]

        // Check if file record already exists for this knowledge document
        const existingFiles = await db
          .select()
          .from(file)
          .where(eq(file.knowledgeDocumentId, doc.id))
          .limit(1)

        if (existingFiles.length > 0) {
          logger.info(`File record already exists for document ${doc.id}`)
          skipped++
          continue
        }

        // Create file record
        await db.insert(file).values({
          userId: source.userId,
          workspaceId: source.workspaceId || null,
          name: doc.name,
          path: doc.filePath!,
          mimeType: doc.fileType || 'application/octet-stream',
          size: doc.fileSize || 0,
          knowledgeDocumentId: doc.id, // Link to knowledge document
          status: 'active',
          metadata: {
            migratedFrom: 'knowledge_document',
            migratedAt: new Date().toISOString(),
            originalDocumentId: doc.id,
          },
          createdAt: doc.createdAt || new Date(),
          updatedAt: new Date(),
        })

        logger.info(`Created file record for: ${doc.name}`)
        created++
      } catch (error) {
        logger.error(`Error processing document ${doc.id}:`, error)
        errors++
      }
    }

    logger.info('Migration complete!', { created, skipped, errors })
    logger.info(`Created: ${created} file records`)
    logger.info(`Skipped: ${skipped} (already exist)`)
    logger.info(`Errors: ${errors}`)

    return { created, skipped, errors }
  } catch (error) {
    logger.error('Migration failed:', error)
    throw error
  }
}

export { migrateKnowledgeDocumentsToFiles }

// Run migration
migrateKnowledgeDocumentsToFiles()
  .then((result) => {
    console.log('Migration successful:', result)
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
