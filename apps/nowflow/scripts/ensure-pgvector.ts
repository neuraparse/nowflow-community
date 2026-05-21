#!/usr/bin/env tsx
import postgres from 'postgres'

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL or POSTGRES_URL must be set before preparing the database')
}

const client = postgres(connectionString, { prepare: false, max: 1 })

try {
  await client`CREATE EXTENSION IF NOT EXISTS vector`
  console.log('pgvector extension is ready')
} catch (error) {
  console.error(
    'Failed to enable the pgvector extension. Make sure your PostgreSQL database supports pgvector and the configured user can create extensions.'
  )
  throw error
} finally {
  await client.end()
}
