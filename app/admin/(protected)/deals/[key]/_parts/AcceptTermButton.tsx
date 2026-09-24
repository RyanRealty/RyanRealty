'use client'

// @no-parity — internal admin tool (one click: the contract's value replaces the file's)
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/v2'
import { acceptContractTerm } from '@/app/actions/tc-deal-terms'

export function AcceptTermButton({ cycleId, column, label }: { cycleId: string; column: string; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Button
        variant="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await acceptContractTerm({ cycleId, column })
            if (!r.ok) setError(r.error ?? 'Not saved.')
            else router.refresh()
          })
        }
      >
        {pending ? 'Saving…' : label}
      </Button>
      {error ? (
        <span role="alert" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          {error}
        </span>
      ) : null}
    </span>
  )
}
