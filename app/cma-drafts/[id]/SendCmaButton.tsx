'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleSend}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send to lead now'}
      </button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Sends from Ryan Realty with the assigned broker as the reply-to. A note
        is recorded in Follow Up Boss so the conversation stays attributed.
      </p>
    </div>
  )
}
