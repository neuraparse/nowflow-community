import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2rem', fontWeight: 300, marginBottom: '0.5rem' }}>404</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>This page could not be found.</p>
      <Link href="/" style={{ color: '#8B5CF6', textDecoration: 'none' }}>
        Go home
      </Link>
    </div>
  )
}
