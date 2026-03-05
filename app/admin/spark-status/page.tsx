import { getSparkConnectionStatus, getSparkDataRange } from '../../../lib/spark'

function formatDate(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export default async function SparkStatusPage() {
  const [status, dateRange] = await Promise.all([
    getSparkConnectionStatus(),
    getSparkDataRange(),
  ])

  return (
    <main style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '600px' }}>
      <h1>Spark API connection</h1>
      {status.connected ? (
        <div style={{ background: '#e6f7ed', padding: '20px', borderRadius: '8px', marginTop: '16px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#0d6832' }}>Connected</p>
          <p style={{ margin: 0, color: '#333' }}>
            You have access to <strong>{status.totalListings?.toLocaleString() ?? '—'}</strong> listings.
          </p>
          {status.totalPages != null && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              ({status.totalPages} pages at {status.pageSize ?? 100} per page)
            </p>
          )}
          {!dateRange.error && (dateRange.oldest || dateRange.newest) && (
            <p style={{ margin: '12px 0 0 0', fontSize: '0.9rem', color: '#333' }}>
              <strong>Data range (On Market Date):</strong> from {formatDate(dateRange.oldest)} to {formatDate(dateRange.newest)}
            </p>
          )}
        </div>
      ) : (
        <div style={{ background: '#fde8e8', padding: '20px', borderRadius: '8px', marginTop: '16px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#b91c1c' }}>Not connected</p>
          <p style={{ margin: 0, color: '#333' }}>{status.error ?? 'Unknown error'}</p>
        </div>
      )}
      <p style={{ marginTop: '24px', fontSize: '0.9rem', color: '#666' }}>
        <a href="/admin/sync">Sync listings to Supabase</a>
      </p>
    </main>
  )
}
