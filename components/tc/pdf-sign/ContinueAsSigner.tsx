'use client'

/**
 * A couple sharing one inbox: once one finishes, the next signer at the same
 * address signs from here (their own link, the one already emailed to them).
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { continueAsNextSigner } from '@/app/actions/tc-sign'

export function ContinueAsSigner({ token, name }: { token: string; name: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function go() {
    setBusy(true)
    setError(null)
    const r = await continueAsNextSigner(token)
    if (r.ok && r.path) {
      window.location.assign(r.path)
      return
    }
    setBusy(false)
    setError(r.error ?? 'Use the email addressed to the next signer.')
  }
  return (
    <div className="mt-6 space-y-2 rounded-md border border-border p-4">
      <p className="text-sm text-foreground">{name} also signs, from this same email address.</p>
      <Button className="w-full" onClick={go} disabled={busy}>
        {busy ? 'Opening…' : `Continue as ${name}`}
      </Button>
      <p className="text-xs text-muted-foreground">Or open the email addressed to {name} later.</p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
