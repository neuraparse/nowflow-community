import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logs/console-logger'
import { createErrorResponse, createSuccessResponse } from '@/app/api/workflows/utils'
import { db } from '@/db'
import * as schema from '@/db/schema'

/**
 * Marketplace Rate API Route Handler
 *
 * Bu dosya marketplace'teki workflow'ları derecelendirme işlemini sağlar.
 * Kullanıcılar workflow'lara 1-5 arası yıldız verebilir ve isteğe bağlı yorum yazabilir.
 *
 * Özellikler:
 * - Yıldız derecelendirme (1-5)
 * - İsteğe bağlı yorum metni
 * - Her kullanıcı workflow başına tek değerlendirme yapabilir (upsert)
 * - Otomatik ortalama rating hesaplama
 *
 * Derecelendirme Süreci:
 * 1. Marketplace entry bulunur ve doğrulanır
 * 2. Kullanıcının önceki değerlendirmesi kontrol edilir
 * 3. Yeni değerlendirme kaydedilir veya güncellenir
 * 4. Marketplace item'ın ortalama rating'i güncellenir
 *
 * @see {@link /api/marketplace/workflows} Marketplace workflow listesi için
 */

const logger = createLogger('MarketplaceRateAPI')

// No cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/marketplace/[id]/rate
 *
 * Bir marketplace workflow'unu değerlendirir. Her kullanıcı workflow başına
 * bir değerlendirme yapabilir. Tekrar değerlendirme yapılırsa önceki kayıt güncellenir.
 *
 * İşlem Adımları:
 * 1. Kullanıcı kimlik doğrulaması yapılır
 * 2. Rating değeri doğrulanır (1-5 arası olmalı)
 * 3. Marketplace entry bulunur ve doğrulanır
 * 4. Kullanıcının önceki değerlendirmesi kontrol edilir
 * 5. Yeni değerlendirme kaydedilir veya güncellenir (upsert)
 * 6. Tüm değerlendirmelerin ortalaması alınır
 * 7. Marketplace entry'nin rating alanı güncellenir
 *
 * @param {NextRequest} request - Next.js request objesi
 * @param {Object} params - Route parametreleri
 * @param {string} params.id - Değerlendirilecek marketplace entry ID
 *
 * @returns {Object} response - Değerlendirme sonucu
 * @returns {string} response.id - Oluşturulan/güncellenen rating ID
 * @returns {number} response.rating - Verilen yıldız sayısı
 * @returns {string} response.review - Yorum metni (opsiyonel)
 * @returns {number} response.newAverage - Güncellenmiş ortalama rating
 * @returns {number} response.totalRatings - Toplam değerlendirme sayısı
 * @returns {string} response.message - Başarı mesajı
 *
 * @throws {401} Unauthorized - Kullanıcı oturum açmamış
 * @throws {400} Bad Request - Geçersiz rating değeri
 * @throws {404} Not Found - Marketplace entry bulunamadı
 * @throws {500} Internal Server Error - Değerlendirme hatası
 *
 * @example
 * // İstek
 * POST /api/marketplace/marketplace-uuid-123/rate
 * {
 *   "rating": 5,
 *   "review": "Excellent workflow, saved me hours!"
 * }
 *
 * // Başarılı Yanıt
 * {
 *   "id": "rating-uuid",
 *   "rating": 5,
 *   "review": "Excellent workflow, saved me hours!",
 *   "newAverage": 4.5,
 *   "totalRatings": 10,
 *   "message": "Rating submitted successfully"
 * }
 *
 * // Hata Yanıtları
 * // 401 Unauthorized
 * {
 *   "error": "Unauthorized"
 * }
 *
 * // 400 Bad Request
 * {
 *   "error": "Rating must be between 1 and 5"
 * }
 *
 * // 404 Not Found
 * {
 *   "error": "Marketplace entry not found"
 * }
 *
 * @note Her kullanıcı bir marketplace item için yalnızca bir değerlendirme yapabilir.
 *       Tekrar değerlendirme yapılırsa önceki kayıt güncellenir.
 * @note Ortalama rating hesaplanırken tüm kullanıcıların değerlendirmeleri dahil edilir.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const { id: marketplaceId } = await params

    // Get the session
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized rating attempt`)
      return createErrorResponse('Unauthorized', 401)
    }

    const userId = session.user.id

    // Parse request body
    const body = await request.json()
    const { rating, review } = body

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      logger.warn(`[${requestId}] Invalid rating value`, { rating })
      return createErrorResponse('Rating must be between 1 and 5', 400)
    }

    // Find the marketplace entry
    const marketplaceEntry = await db
      .select({
        id: schema.marketplace.id,
        name: schema.marketplace.name,
      })
      .from(schema.marketplace)
      .where(eq(schema.marketplace.id, marketplaceId))
      .limit(1)
      .then((rows: any) => rows[0])

    if (!marketplaceEntry) {
      logger.warn(`[${requestId}] No marketplace entry found with ID: ${marketplaceId}`)
      return createErrorResponse('Marketplace entry not found', 404)
    }

    const now = new Date()

    try {
      // Check if user already rated this item
      const existingRating = await db
        .select({
          id: schema.marketplaceRating.id,
        })
        .from(schema.marketplaceRating)
        .where(
          and(
            eq(schema.marketplaceRating.marketplaceId, marketplaceId),
            eq(schema.marketplaceRating.userId, userId)
          )
        )
        .limit(1)
        .then((rows: any) => rows[0])

      let ratingId: string

      if (existingRating) {
        // Update existing rating
        ratingId = existingRating.id
        await db
          .update(schema.marketplaceRating)
          .set({
            rating,
            review: review || null,
            updatedAt: now,
          })
          .where(eq(schema.marketplaceRating.id, ratingId))

        logger.info(`[${requestId}] Updated existing rating`, {
          marketplaceId,
          userId,
          ratingId,
          rating,
        })
      } else {
        // Create new rating
        ratingId = uuidv4()
        await db.insert(schema.marketplaceRating).values({
          id: ratingId,
          marketplaceId,
          userId,
          rating,
          review: review || null,
          createdAt: now,
          updatedAt: now,
        })

        logger.info(`[${requestId}] Created new rating`, {
          marketplaceId,
          userId,
          ratingId,
          rating,
        })
      }

      // Calculate new average rating
      const allRatings = await db
        .select({
          rating: schema.marketplaceRating.rating,
        })
        .from(schema.marketplaceRating)
        .where(eq(schema.marketplaceRating.marketplaceId, marketplaceId))

      const totalRatings = allRatings.length
      const sumRatings = allRatings.reduce((sum: any, r: any) => sum + r.rating, 0)
      const newAverage = totalRatings > 0 ? sumRatings / totalRatings : 0

      // Update marketplace entry with new average
      await db
        .update(schema.marketplace)
        .set({
          rating: newAverage.toFixed(2),
          ratingCount: totalRatings,
          updatedAt: now,
        })
        .where(eq(schema.marketplace.id, marketplaceId))

      logger.info(`[${requestId}] Updated marketplace rating average`, {
        marketplaceId,
        newAverage,
        totalRatings,
      })

      return createSuccessResponse({
        id: ratingId,
        rating,
        review: review || null,
        newAverage: parseFloat(newAverage.toFixed(2)),
        totalRatings,
        message: 'Rating submitted successfully',
      })
    } catch (dbError) {
      logger.error(`[${requestId}] Database error rating marketplace item`, {
        error: dbError,
        marketplaceId,
        userId,
      })
      return createErrorResponse('Failed to submit rating', 500)
    }
  } catch (error: any) {
    logger.error(`[${requestId}] Error rating marketplace item`, error)
    return createErrorResponse(`Failed to submit rating: ${error.message}`, 500)
  }
}
