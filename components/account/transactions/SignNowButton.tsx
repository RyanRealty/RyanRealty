'use client'

/**
 * Sign now — mints a fresh signing link for the signed-in client and sends
 * their browser straight to it. openMySigningLink() re-checks the signed-in
 * email against the recipient row server-side (see
 * app/actions/client-transactions.ts); this component trusts nothing about
 * the recipientId it was handed beyond passing it along.
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { openMySigningLink } from '@/app/actions/client-transactions'

export function SignNowButton({ recipientId }: { recipientId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await openMySigningLink(recipientId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.assign(result.url)
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <Button type="button" disabled={pending} onClick={onClick} className="h-11 px-5">
        {pending ? 'Opening…' : 'Sign now'}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </div>
  )
}
