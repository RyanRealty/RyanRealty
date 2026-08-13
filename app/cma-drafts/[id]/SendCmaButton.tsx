'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { V3Button } from '@/components/site/v3'

export function SendCmaButton({
  deliveryId,
  token,
}: {
  deliveryId: string
  token: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/cma-drafts/${deliveryId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok || !data.ok) {
        setError(data.error ?? `Send failed (${r.status})`)
        setBusy(false)
        return
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      setBusy(false)
    }
  }

  return (
    <div className="v3">
      <V3Button type="button" onClick={handleSend} disabled={busy}>
        {busy ? 'Sending' : 'Send to the lead now'}
      </V3Button>
      {error ? <p>{error}</p> : null}
    </div>
  )
}
