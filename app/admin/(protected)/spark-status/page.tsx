import Link from 'next/link'
import { getSparkConnectionStatus, getSparkDataRange } from '@/lib/spark'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Spark API connection</h1>
      {status.connected ? (
        <Alert className="mt-4 border-success bg-success/10">
          <AlertTitle className="text-success">Connected</AlertTitle>
          <AlertDescription className="text-foreground">
            You have access to <strong>{status.totalListings?.toLocaleString() ?? '—'}</strong> listings.
            {status.totalPages != null && (
              <div className="mt-2 text-sm">
                ({status.totalPages} pages at {status.pageSize ?? 100} per page)
              </div>
            )}
            {!dateRange.error && (dateRange.oldest || dateRange.newest) && (
              <div className="mt-2 text-sm">
                <strong>Data range (On Market Date):</strong> from {formatDate(dateRange.oldest)} to {formatDate(dateRange.newest)}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mt-4 border-destructive bg-destructive/10">
          <AlertTitle className="text-destructive">Not connected</AlertTitle>
          <AlertDescription className="text-foreground">
            {status.error ?? 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/admin/sync" className="underline hover:no-underline">Sync listings to Supabase</Link>
      </p>
    </main>
  )
}
