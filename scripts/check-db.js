#!/usr/bin/env node
import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  console.error('DATABASE_URL or POSTGRES_URL must be set')
  process.exit(1)
}

console.log('Database check')
console.log('==============')
console.log(`Connecting to: ${connectionString.replace(/:[^:]*@/, ':****@')}`)

let sql

try {
  sql = postgres(connectionString)
  const [dbInfo] = await sql`select current_database() as database, current_user as user`
  const [{ count: userCount }] = await sql`select count(*)::int as count from "user"`
  const [{ count: workflowCount }] = await sql`select count(*)::int as count from workflow`

  console.log(`Database: ${dbInfo.database}`)
  console.log(`User: ${dbInfo.user}`)
  console.log(`Users: ${userCount}`)
  console.log(`Workflows: ${workflowCount}`)
  console.log('OK')
} catch (error) {
  console.error('Database check failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  if (sql) await sql.end()
}
