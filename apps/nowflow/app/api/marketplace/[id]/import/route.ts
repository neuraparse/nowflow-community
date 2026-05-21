import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import {
  createWorkflowWithLimits,
  WorkflowCreationLimitError,
} from '@/lib/workflows/create-workflow'
import { createErrorResponse, createSuccessResponse } from '@/app/api/workflows/utils'
import { db } from '@/db'
import * as schema from '@/db/schema'

/**
 * Marketplace Import API Route Handler
 *
 * Bu dosya marketplace'ten workflow içe aktarma işlemini sağlar.
 * Kullanıcılar marketplace'teki workflow'ları kendi workspace'lerine kopyalayabilir.
 *
 * Özellikler:
 * - Marketplace'ten workflow kopyalama
 * - Workflow state temizleme ve validasyon
 * - Kullanım sayısı takibi (useCount)
 * - Kategori bazlı renk atama
 * - Otomatik "(Copy)" ekleme
 *
 * İçe Aktarma Süreci:
 * 1. Marketplace entry bulunur
 * 2. Workflow state temizlenir (orphan edge'ler kaldırılır)
 * 3. Yeni workflow ID oluşturulur
 * 4. Kullanıcının workspace'ine yeni workflow eklenir
 * 5. Marketplace entry'nin useCount değeri artırılır
 *
 * @see {@link /api/marketplace/workflows} Marketplace workflow listesi için
 */

const logger = createLogger('MarketplaceImportAPI')

// No cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/marketplace/[id]/import
 *
 * Marketplace'ten bir workflow'u kullanıcının workspace'ine içe aktarır.
 * İçe aktarılan workflow yeni bir ID ile oluşturulur ve orijinal workflow'dan bağımsızdır.
 *
 * İşlem Adımları:
 * 1. Kullanıcı kimlik doğrulaması yapılır
 * 2. Marketplace entry bulunur ve doğrulanır
 * 3. Yeni workflow ID oluşturulur
 * 4. Workflow state temizlenir (geçersiz referanslar kaldırılır)
 * 5. Kategori bazlı renk atanır
 * 6. Kullanıcının workspace'ine yeni workflow eklenir
 * 7. Marketplace entry'nin useCount değeri artırılır
 *
 * @param {NextRequest} request - Next.js request objesi
 * @param {Object} params - Route parametreleri
 * @param {string} params.id - İçe aktarılacak marketplace entry ID
 *
 * @returns {Object} response - İçe aktarma sonucu
 * @returns {string} response.id - Yeni oluşturulan workflow ID
 * @returns {string} response.name - Workflow adı (orijinal ad + " (Copy)")
 * @returns {string} response.description - Workflow açıklaması
 * @returns {string} response.color - Kategori bazlı renk kodu
 * @returns {string} response.message - Başarı mesajı
 *
 * @throws {401} Unauthorized - Kullanıcı oturum açmamış
 * @throws {404} Not Found - Marketplace entry bulunamadı
 * @throws {500} Internal Server Error - İçe aktarma hatası
 *
 * @example
 * // İstek
 * POST /api/marketplace/marketplace-uuid-123/import
 *
 * // Başarılı Yanıt
 * {
 *   "id": "new-workflow-uuid",
 *   "name": "Customer Support Automation (Copy)",
 *   "description": "Automates customer support ticket handling",
 *   "color": "#3B82F6",
 *   "message": "Workflow imported successfully"
 * }
 *
 * // Hata Yanıtları
 * // 401 Unauthorized
 * {
 *   "error": "Unauthorized"
 * }
 *
 * // 404 Not Found
 * {
 *   "error": "Marketplace entry not found"
 * }
 *
 * @note İçe aktarılan workflow'un marketplaceData alanı null olarak ayarlanır,
 *       böylece orijinal yayından bağımsız olur.
 * @note Her içe aktarma işlemi marketplace entry'nin useCount değerini 1 artırır.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const { id: marketplaceId } = await params

    // Get the session
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized marketplace import attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    const userId = session.user.id

    // Find the marketplace entry
    const marketplaceEntry = await db
      .select({
        id: schema.marketplace.id,
        workflowId: schema.marketplace.workflowId,
        state: schema.marketplace.state,
        name: schema.marketplace.name,
        description: schema.marketplace.description,
        authorId: schema.marketplace.authorId,
        authorName: schema.marketplace.authorName,
        category: schema.marketplace.category,
        useCount: schema.marketplace.useCount,
      })
      .from(schema.marketplace)
      .where(eq(schema.marketplace.id, marketplaceId))
      .limit(1)
      .then((rows: any) => rows[0])

    if (!marketplaceEntry) {
      logger.warn(`[${requestId}] No marketplace entry found with ID: ${marketplaceId}`)
      return createErrorResponse('Marketplace entry not found', 404)
    }

    // Generate new workflow ID
    const newWorkflowId = uuidv4()
    const now = new Date()

    // Get color for category
    const color = getColorForCategory(marketplaceEntry.category || 'general')

    // Clean the workflow state to ensure consistency
    const cleanedState = cleanWorkflowState(marketplaceEntry.state)

    try {
      await createWorkflowWithLimits({
        id: newWorkflowId,
        userId,
        name: `${marketplaceEntry.name} (Copy)`,
        description: marketplaceEntry.description || '',
        color,
        state: cleanedState,
        isDeployed: false,
        runCount: 0,
        marketplaceData: null,
        now,
      })

      // Increment the use count for the marketplace entry
      await db
        .update(schema.marketplace)
        .set({
          useCount: sql`${schema.marketplace.useCount} + 1`,
          updatedAt: now,
        })
        .where(eq(schema.marketplace.id, marketplaceId))

      logger.info(`[${requestId}] Successfully imported workflow from marketplace`, {
        marketplaceId,
        newWorkflowId,
        userId,
        originalName: marketplaceEntry.name,
      })

      return createSuccessResponse({
        id: newWorkflowId,
        name: `${marketplaceEntry.name} (Copy)`,
        description: marketplaceEntry.description || '',
        color: color,
        message: 'Workflow imported successfully',
      })
    } catch (dbError) {
      if (dbError instanceof WorkflowCreationLimitError) {
        logger.warn(`[${requestId}] Marketplace import blocked by limits`, {
          marketplaceId,
          userId,
          code: dbError.code,
        })
        return createErrorResponse(dbError.message, dbError.status)
      }

      logger.error(`[${requestId}] Database error importing workflow`, {
        error: dbError,
        marketplaceId,
        userId,
      })
      return createErrorResponse('Failed to import workflow', 500)
    }
  } catch (error: any) {
    logger.error(`[${requestId}] Error importing workflow from marketplace`, error)
    return createErrorResponse(`Failed to import workflow: ${error.message}`, 500)
  }
}

/**
 * Workflow state'ini temizler ve tutarlılığı sağlar
 *
 * Bu fonksiyon workflow state'indeki geçersiz referansları kaldırır:
 * - Orphan edge'ler (var olmayan block'lara işaret eden)
 * - Geçersiz veya eksik edge bilgileri
 * - Boş veya geçersiz state objeleri
 *
 * @param {any} state - Temizlenecek workflow state objesi
 * @returns {Object} Temizlenmiş workflow state
 * @returns {Object} return.blocks - Block'lar objesi
 * @returns {Array} return.edges - Geçerli edge'ler dizisi
 *
 * @example
 * const dirtyState = {
 *   blocks: { 'block-1': {...}, 'block-2': {...} },
 *   edges: [
 *     { source: 'block-1', target: 'block-2' },  // Geçerli
 *     { source: 'block-1', target: 'block-3' },  // Geçersiz (block-3 yok)
 *     { source: null, target: 'block-2' }        // Geçersiz (null source)
 *   ]
 * }
 *
 * const cleanState = cleanWorkflowState(dirtyState)
 * // Returns:
 * // {
 * //   blocks: { 'block-1': {...}, 'block-2': {...} },
 * //   edges: [{ source: 'block-1', target: 'block-2' }]
 * // }
 */
function cleanWorkflowState(state: any): any {
  if (!state || typeof state !== 'object') {
    return { blocks: {}, edges: [] }
  }

  const blocks = state.blocks || {}
  const edges = state.edges || []

  // Get all valid block IDs
  const validBlockIds = new Set(Object.keys(blocks))

  // Filter edges to only include those with valid source and target blocks
  const cleanedEdges = edges.filter((edge: any) => {
    if (!edge || !edge.source || !edge.target) {
      return false
    }
    return validBlockIds.has(edge.source) && validBlockIds.has(edge.target)
  })

  return {
    ...state,
    blocks,
    edges: cleanedEdges,
  }
}

/**
 * Kategori bazlı renk kodu döndürür
 *
 * Her workflow kategorisi için önceden tanımlanmış profesyonel ve açık ton renk kodu vardır.
 * Bu renkler UI'da workflow'ları görsel olarak ayırt etmek için kullanılır.
 * Renkler WCAG AA standartlarına uygun seçilmiştir.
 *
 * @param {string} category - Workflow kategorisi
 * @returns {string} Hex renk kodu (örn: '#60A5FA')
 *
 * @example
 * getColorForCategory('automation')  // Returns: '#818CF8' (soft indigo)
 * getColorForCategory('customer-service')  // Returns: '#60A5FA' (soft blue)
 * getColorForCategory('unknown')  // Returns: '#94A3B8' (soft slate - varsayılan)
 *
 * Kategori Renkleri (Profesyonel Açık Tonlar):
 * - getting-started: Soft Emerald (#6EE7B7)
 * - content-creation: Soft Purple (#C084FC)
 * - customer-service: Soft Blue (#60A5FA)
 * - data-analysis: Soft Amber (#FCD34D)
 * - ecommerce: Soft Rose (#FB7185)
 * - education: Soft Cyan (#67E8F9)
 * - healthcare: Soft Pink (#F9A8D4)
 * - automation: Soft Indigo (#818CF8)
 * - productivity: Soft Teal (#5EEAD4)
 * - marketing: Soft Orange (#FDBA74)
 * - finance: Soft Violet (#A78BFA)
 * - general: Soft Slate (#94A3B8) - Varsayılan
 */
function getColorForCategory(category: string): string {
  const colors: Record<string, string> = {
    'getting-started': '#6EE7B7', // soft emerald - welcoming and fresh
    'content-creation': '#C084FC', // soft purple - creative
    'customer-service': '#60A5FA', // soft blue - trustworthy and calm
    'data-analysis': '#FCD34D', // soft amber - analytical and bright
    ecommerce: '#FB7185', // soft rose - engaging and warm
    education: '#67E8F9', // soft cyan - clear and educational
    healthcare: '#F9A8D4', // soft pink - caring and gentle
    automation: '#818CF8', // soft indigo - technical and modern
    productivity: '#5EEAD4', // soft teal - efficient and balanced
    marketing: '#FDBA74', // soft orange - energetic and friendly
    finance: '#A78BFA', // soft violet - professional and stable
    general: '#94A3B8', // soft slate - neutral and versatile
  }
  return colors[category] || colors.general
}
