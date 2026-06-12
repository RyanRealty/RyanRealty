'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/** Stale-deploy signatures: the open tab references JS chunks a newer deploy
 *  replaced. A full reload fetches the current build and recovers — do it
 *  automatically, once, instead of showing a dead error screen. */
function isStaleChunkError(error: Error): boolean {
  return /ChunkLoadError|Loading chunk|dynamically imported module|import\(\) failed|fetch.*chunk/i.test(
    `${error.name} ${error.message}`,
  )
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    if (isStaleChunkError(error)) {
      const key = 'rr-admin-stale-reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, String(Date.now()))
        window.location.reload()
      }
    } else {
      sessionStorage.removeItem('rr-admin-stale-reload')
    }
  }, [error])

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground">Admin error</h2>
      <p className="mt-2 text-sm text-muted-foreground">Something went wrong in the admin.</p>
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={reset} variant="outline">Try again</Button>
        <Button type="button" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  )
}
