// Check if we're on the server side
const isServer = typeof window === 'undefined'

let db: any

if (isServer) {
  // Server-side: use real postgres connection
  const { drizzle } = require('drizzle-orm/postgres-js')
  const postgres = require('postgres')
  const schema = require('./schema')

  // In deployed/self-hosted installs, use the configured POSTGRES_URL
  // In development, use the direct DATABASE_URL
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL!

  // Disable prefetch as it is not supported for "Transaction" pool mode
  const client = postgres(connectionString, {
    prepare: false,
    idle_timeout: 30, // Keep connections alive for 30 seconds when idle
    connect_timeout: 30, // Timeout after 30 seconds when connecting
    max: 10, // Limit connection pool size to prevent exhaustion
    // Suppress PostgreSQL lock warnings that are harmless in transaction mode
    onnotice: (notice: any) => {
      // Only suppress specific lock warnings, log everything else
      if (
        notice.code === '01000' &&
        notice.message?.includes("you don't own a lock of type ExclusiveLock")
      ) {
        return // Suppress this specific warning
      }
      console.warn('PostgreSQL Notice:', notice)
    },
  })

  db = drizzle(client, { schema })
} else {
  // Client-side: use mock db that throws errors
  db = new Proxy(
    {},
    {
      get: () => {
        throw new Error('Database operations are not available on the client side')
      },
    }
  )
}

// Export the database client
export { db }
