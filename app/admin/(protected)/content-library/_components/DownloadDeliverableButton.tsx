'use client'

/**
 * Sign a deliverable download only when the broker clicks — signing every row
 * on SSR was 28–44s across hundreds of objects (12-admin-chrome-debt).
 */

import { useState, useTransition } from 'react'
import { signDeliverableForDownload } from '@/app/actions/content-library-download'
import { Button } from '@/components/admin/v2'

export function DownloadDeliverableButton({
  actionId,
  filename,
}: {
  actionId: string
  filename: string
}) {
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <Button
        type="button"
        variant="quiet"
        disabled={pending}
        onClick={() => {
          setErr(null)
          start(async () => {
            const res = await signDeliverableForDownload({ actionId, filename })
            if (!res.ok) {
              setErr(res.error || 'Could not sign download')
              return
            }
            // Open signed URL in the same tab (download attribute is best-effort
            // for cross-origin storage hosts).
            window.location.href = res.url
          })
        }}
      >
        {pending ? 'Signing…' : 'Download'}
      </Button>
      {err ? (
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{err}</span>
      ) : null}
    </span>
  )
}
