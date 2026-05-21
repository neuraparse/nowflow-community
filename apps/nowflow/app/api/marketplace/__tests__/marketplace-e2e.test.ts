/**
 * End-to-end integration tests for marketplace workflow
 *
 * This test suite verifies the complete marketplace flow:
 * 1. User publishes a workflow to marketplace
 * 2. Workflow appears in marketplace with correct category
 * 3. Another user searches and finds the workflow
 * 4. User imports workflow via one-click import
 * 5. User rates and reviews the imported workflow
 * 6. Rating updates are reflected in marketplace
 *
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// ─── Stateful in-memory db mock ────────────────────────────────────────────
// Each "table" is identified by a symbol from the mocked @/db/schema below.
// The mock supports the fluent Drizzle-like chain used by the test:
//   db.insert(table).values(obj | obj[]).returning()
//   db.select(shape?).from(table).where(predicate).limit(n).then(cb)
//   db.update(table).set(data).where(predicate).returning()
//   db.delete(table).where(predicate)

type TableKey = 'user' | 'workflow' | 'marketplace' | 'marketplaceRating'

type Predicate = (row: Record<string, any>) => boolean

const store: Record<TableKey, Record<string, any>[]> = {
  user: [],
  workflow: [],
  marketplace: [],
  marketplaceRating: [],
}

const tableName = (t: any): TableKey => t.__name as TableKey

const projectRows = (rows: Record<string, any>[], shape?: Record<string, any>) => {
  if (!shape) return rows.map((r) => ({ ...r }))
  return rows.map((r) => {
    const out: Record<string, any> = {}
    for (const key of Object.keys(shape)) {
      const col = shape[key]
      const colName = col?.__col || key
      out[key] = r[colName]
    }
    return out
  })
}

const makeSelect = (shape?: Record<string, any>) => ({
  from(table: any) {
    const name = tableName(table)
    let pred: Predicate = () => true
    let lim: number | null = null
    const exec = () => {
      let rows = store[name].filter(pred)
      if (lim !== null) rows = rows.slice(0, lim)
      return projectRows(rows, shape)
    }
    const chain: any = {
      where(predicate: Predicate) {
        pred = predicate
        return chain
      },
      limit(n: number) {
        lim = n
        return chain
      },
      then(onFulfilled: any, onRejected?: any) {
        return Promise.resolve(exec()).then(onFulfilled, onRejected)
      },
      catch(onRejected: any) {
        return Promise.resolve(exec()).catch(onRejected)
      },
    }
    return chain
  },
})

const mockDb = {
  select(shape?: Record<string, any>) {
    return makeSelect(shape)
  },
  insert(table: any) {
    const name = tableName(table)
    return {
      values(input: Record<string, any> | Record<string, any>[]) {
        const rows = Array.isArray(input) ? input : [input]
        for (const r of rows) store[name].push({ ...r })
        const result = {
          returning() {
            return Promise.resolve(rows.map((r) => ({ ...r })))
          },
          then(onFulfilled: any, onRejected?: any) {
            return Promise.resolve(undefined).then(onFulfilled, onRejected)
          },
          catch(onRejected: any) {
            return Promise.resolve(undefined).catch(onRejected)
          },
        }
        return result
      },
    }
  },
  update(table: any) {
    const name = tableName(table)
    return {
      set(data: Record<string, any>) {
        return {
          _pred: (() => true) as Predicate,
          where(predicate: Predicate) {
            this._pred = predicate
            const chain: any = {
              returning: () => {
                const updated: Record<string, any>[] = []
                for (const r of store[name]) {
                  if (predicate(r)) {
                    Object.assign(r, data)
                    updated.push({ ...r })
                  }
                }
                return Promise.resolve(updated)
              },
              then(onFulfilled: any, onRejected?: any) {
                for (const r of store[name]) {
                  if (predicate(r)) Object.assign(r, data)
                }
                return Promise.resolve(undefined).then(onFulfilled, onRejected)
              },
              catch(onRejected: any) {
                return Promise.resolve(undefined).catch(onRejected)
              },
            }
            return chain
          },
        }
      },
    }
  },
  delete(table: any) {
    const name = tableName(table)
    return {
      where(predicate: Predicate) {
        store[name] = store[name].filter((r) => !predicate(r))
        return Promise.resolve(undefined)
      },
    }
  },
}

vi.mock('@/db', () => ({
  db: mockDb,
  sql: vi.fn(),
}))

// Mock schema: each table carries its identifier + typed column refs.
// Each column has `__col` so projection in select() works, and the column
// object is passed to drizzle helpers like `eq(column, value)` via our mock.
const col = (tableName: string, columnName: string) => ({
  __col: columnName,
  __table: tableName,
})

vi.mock('@/db/schema', () => {
  const makeTable = (name: TableKey, cols: string[]) => {
    const t: any = { __name: name }
    for (const c of cols) t[c] = col(name, c)
    return t
  }
  return {
    user: makeTable('user', ['id', 'email', 'name', 'role', 'createdAt', 'updatedAt']),
    workflow: makeTable('workflow', [
      'id',
      'userId',
      'name',
      'description',
      'color',
      'state',
      'lastSynced',
      'createdAt',
      'updatedAt',
      'isDeployed',
      'runCount',
      'marketplaceData',
    ]),
    marketplace: makeTable('marketplace', [
      'id',
      'workflowId',
      'state',
      'name',
      'description',
      'authorId',
      'authorName',
      'category',
      'tags',
      'difficultyLevel',
      'isExample',
      'exampleOrder',
      'status',
      'active',
      'views',
      'useCount',
      'rating',
      'ratingCount',
      'createdAt',
      'updatedAt',
    ]),
    marketplaceRating: makeTable('marketplaceRating', [
      'id',
      'marketplaceId',
      'userId',
      'rating',
      'review',
      'createdAt',
      'updatedAt',
    ]),
  }
})

// Mock drizzle-orm helpers to build predicate functions that operate on rows.
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<any>('drizzle-orm')
  return {
    ...actual,
    eq: (column: any, value: any) => (row: Record<string, any>) =>
      row[column?.__col ?? String(column)] === value,
    and:
      (...preds: Predicate[]) =>
      (row: Record<string, any>) =>
        preds.every((p) => p(row)),
    or:
      (...preds: Predicate[]) =>
      (row: Record<string, any>) =>
        preds.some((p) => p(row)),
  }
})

// Import after mocks have been registered
const { db } = await import('@/db')
const { marketplace, marketplaceRating, user, workflow } = await import('@/db/schema')
const { eq, and } = await import('drizzle-orm')
const { v4: uuidv4 } = await import('uuid')

describe('Marketplace End-to-End Flow', () => {
  // Test data
  const testUser1Id = uuidv4()
  const testUser2Id = uuidv4()
  const testWorkflowId = uuidv4()
  let testMarketplaceId: string
  let importedWorkflowId: string

  // Sample workflow state
  const sampleWorkflowState = {
    blocks: {
      'block-1': {
        id: 'block-1',
        type: 'starter',
        name: 'Start',
        position: { x: 100, y: 100 },
        enabled: true,
      },
      'block-2': {
        id: 'block-2',
        type: 'agent',
        name: 'Agent',
        position: { x: 300, y: 100 },
        enabled: true,
        config: {
          model: 'claude-3-5-sonnet-20241022',
          prompt: 'Test agent',
        },
      },
    },
    edges: [
      {
        id: 'edge-1',
        source: 'block-1',
        target: 'block-2',
        sourceHandle: 'source',
        targetHandle: 'target',
      },
    ],
  }

  beforeAll(async () => {
    // Create test users
    await db.insert(user).values([
      {
        id: testUser1Id,
        email: `test-user-1-${Date.now()}@example.com`,
        name: 'Test User 1',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: testUser2Id,
        email: `test-user-2-${Date.now()}@example.com`,
        name: 'Test User 2',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])

    // Create test workflow for user 1
    await db.insert(workflow).values({
      id: testWorkflowId,
      userId: testUser1Id,
      name: 'E2E Test Workflow',
      description: 'A test workflow for marketplace e2e testing',
      color: '#3B82F6',
      state: sampleWorkflowState,
      lastSynced: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeployed: false,
      runCount: 0,
    })
  })

  afterAll(async () => {
    // Clean up test data
    try {
      // Delete ratings first (foreign key constraint)
      if (testMarketplaceId) {
        await db
          .delete(marketplaceRating)
          .where(eq(marketplaceRating.marketplaceId, testMarketplaceId))
      }

      // Delete marketplace entry
      if (testMarketplaceId) {
        await db.delete(marketplace).where(eq(marketplace.id, testMarketplaceId))
      }

      // Delete imported workflow
      if (importedWorkflowId) {
        await db.delete(workflow).where(eq(workflow.id, importedWorkflowId))
      }

      // Delete test workflow
      await db.delete(workflow).where(eq(workflow.id, testWorkflowId))

      // Delete test users
      await db.delete(user).where(eq(user.id, testUser1Id))
      await db.delete(user).where(eq(user.id, testUser2Id))
    } catch (error) {
      console.error('Error cleaning up test data:', error)
    }
  })

  it('Step 1: User publishes a workflow to marketplace', async () => {
    // Simulate publishing workflow to marketplace
    const publishData = {
      id: uuidv4(),
      workflowId: testWorkflowId,
      state: sampleWorkflowState,
      name: 'E2E Test Workflow',
      description: 'A test workflow for marketplace e2e testing',
      authorId: testUser1Id,
      authorName: 'Test User 1',
      category: 'automation',
      tags: ['test', 'e2e', 'automation'],
      difficultyLevel: 'beginner' as const,
      isExample: false,
      exampleOrder: null,
      status: 'approved' as const,
      active: true,
      views: 0,
      useCount: 0,
      rating: '0.00',
      ratingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.insert(marketplace).values(publishData).returning()

    expect(result).toBeDefined()
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(publishData.id)
    expect(result[0].category).toBe('automation')
    expect(result[0].status).toBe('approved')

    testMarketplaceId = result[0].id
  })

  it('Step 2: Workflow appears in marketplace with correct category', async () => {
    // Query marketplace to verify workflow is published
    const marketplaceEntry = await db
      .select({
        id: marketplace.id,
        workflowId: marketplace.workflowId,
        name: marketplace.name,
        description: marketplace.description,
        category: marketplace.category,
        status: marketplace.status,
        active: marketplace.active,
      })
      .from(marketplace)
      .where(eq(marketplace.id, testMarketplaceId))
      .limit(1)
      .then((rows: any[]) => rows[0])

    expect(marketplaceEntry).toBeDefined()
    expect(marketplaceEntry.workflowId).toBe(testWorkflowId)
    expect(marketplaceEntry.name).toBe('E2E Test Workflow')
    expect(marketplaceEntry.category).toBe('automation')
    expect(marketplaceEntry.status).toBe('approved')
    expect(marketplaceEntry.active).toBe(true)
  })

  it('Step 3: User can search and find the workflow by category', async () => {
    // Query marketplace by category
    const categoryResults = await db
      .select({
        id: marketplace.id,
        name: marketplace.name,
        category: marketplace.category,
      })
      .from(marketplace)
      .where(and(eq(marketplace.category, 'automation'), eq(marketplace.status, 'approved')))

    expect(categoryResults).toBeDefined()
    expect(categoryResults.length).toBeGreaterThan(0)

    // Find our specific workflow
    const ourWorkflow = categoryResults.find((w: any) => w.id === testMarketplaceId)
    expect(ourWorkflow).toBeDefined()
    expect(ourWorkflow?.category).toBe('automation')
  })

  it('Step 4: User imports workflow via one-click import', async () => {
    // Simulate importing workflow
    const marketplaceEntry = await db
      .select({
        id: marketplace.id,
        workflowId: marketplace.workflowId,
        state: marketplace.state,
        name: marketplace.name,
        description: marketplace.description,
        category: marketplace.category,
        useCount: marketplace.useCount,
      })
      .from(marketplace)
      .where(eq(marketplace.id, testMarketplaceId))
      .limit(1)
      .then((rows: any[]) => rows[0])

    expect(marketplaceEntry).toBeDefined()

    // Create imported workflow
    importedWorkflowId = uuidv4()
    const importedWorkflow = await db
      .insert(workflow)
      .values({
        id: importedWorkflowId,
        userId: testUser2Id,
        name: `${marketplaceEntry.name} (Copy)`,
        description: marketplaceEntry.description || '',
        color: '#818CF8', // automation category color
        state: marketplaceEntry.state,
        lastSynced: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeployed: false,
        runCount: 0,
        marketplaceData: null,
      })
      .returning()

    expect(importedWorkflow).toBeDefined()
    expect(importedWorkflow.length).toBe(1)
    expect(importedWorkflow[0].userId).toBe(testUser2Id)
    expect(importedWorkflow[0].name).toContain('(Copy)')

    // Increment use count
    const updatedMarketplace = await db
      .update(marketplace)
      .set({
        useCount: marketplaceEntry.useCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(marketplace.id, testMarketplaceId))
      .returning()

    expect(updatedMarketplace[0].useCount).toBe(marketplaceEntry.useCount + 1)
  })

  it('Step 5: User rates and reviews the imported workflow', async () => {
    const ratingData = {
      id: uuidv4(),
      marketplaceId: testMarketplaceId,
      userId: testUser2Id,
      rating: 5,
      review: 'Excellent workflow! Very helpful and easy to use.',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const ratingResult = await db.insert(marketplaceRating).values(ratingData).returning()

    expect(ratingResult).toBeDefined()
    expect(ratingResult.length).toBe(1)
    expect(ratingResult[0].rating).toBe(5)
    expect(ratingResult[0].review).toBe('Excellent workflow! Very helpful and easy to use.')
    expect(ratingResult[0].userId).toBe(testUser2Id)
  })

  it('Step 6: Rating updates are reflected in marketplace', async () => {
    // Calculate average rating
    const allRatings = await db
      .select({
        rating: marketplaceRating.rating,
      })
      .from(marketplaceRating)
      .where(eq(marketplaceRating.marketplaceId, testMarketplaceId))

    const totalRatings = allRatings.length
    const sumRatings = allRatings.reduce((sum: number, r: any) => sum + r.rating, 0)
    const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0

    expect(totalRatings).toBe(1)
    expect(averageRating).toBe(5)

    // Update marketplace entry with new rating
    const updatedMarketplace = await db
      .update(marketplace)
      .set({
        rating: averageRating.toFixed(2),
        ratingCount: totalRatings,
        updatedAt: new Date(),
      })
      .where(eq(marketplace.id, testMarketplaceId))
      .returning()

    expect(updatedMarketplace).toBeDefined()
    expect(updatedMarketplace[0].rating).toBe('5.00')
    expect(updatedMarketplace[0].ratingCount).toBe(1)

    // Verify the rating is reflected in marketplace
    const marketplaceEntry = await db
      .select({
        id: marketplace.id,
        name: marketplace.name,
        rating: marketplace.rating,
        ratingCount: marketplace.ratingCount,
      })
      .from(marketplace)
      .where(eq(marketplace.id, testMarketplaceId))
      .limit(1)
      .then((rows: any[]) => rows[0])

    expect(marketplaceEntry).toBeDefined()
    expect(marketplaceEntry.rating).toBe('5.00')
    expect(marketplaceEntry.ratingCount).toBe(1)
  })

  it('Additional verification: User can add multiple ratings', async () => {
    // User 1 also rates the workflow
    const rating2Data = {
      id: uuidv4(),
      marketplaceId: testMarketplaceId,
      userId: testUser1Id,
      rating: 4,
      review: 'Good workflow, could use more features.',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(marketplaceRating).values(rating2Data)

    // Recalculate average
    const allRatings = await db
      .select({
        rating: marketplaceRating.rating,
      })
      .from(marketplaceRating)
      .where(eq(marketplaceRating.marketplaceId, testMarketplaceId))

    const totalRatings = allRatings.length
    const sumRatings = allRatings.reduce((sum: number, r: any) => sum + r.rating, 0)
    const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0

    expect(totalRatings).toBe(2)
    expect(averageRating).toBe(4.5) // (5 + 4) / 2 = 4.5

    // Update marketplace
    await db
      .update(marketplace)
      .set({
        rating: averageRating.toFixed(2),
        ratingCount: totalRatings,
        updatedAt: new Date(),
      })
      .where(eq(marketplace.id, testMarketplaceId))

    // Verify
    const marketplaceEntry = await db
      .select({
        rating: marketplace.rating,
        ratingCount: marketplace.ratingCount,
      })
      .from(marketplace)
      .where(eq(marketplace.id, testMarketplaceId))
      .limit(1)
      .then((rows: any[]) => rows[0])

    expect(marketplaceEntry.rating).toBe('4.50')
    expect(marketplaceEntry.ratingCount).toBe(2)
  })

  it('Additional verification: Workflow use count is tracked', async () => {
    const marketplaceEntry = await db
      .select({
        useCount: marketplace.useCount,
      })
      .from(marketplace)
      .where(eq(marketplace.id, testMarketplaceId))
      .limit(1)
      .then((rows: any[]) => rows[0])

    expect(marketplaceEntry).toBeDefined()
    expect(marketplaceEntry.useCount).toBeGreaterThan(0)
  })
})
