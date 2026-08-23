'use client'

// @no-parity — internal admin tool (compose a library blank onto a live deal)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, ToolbarRadio } from '@/components/admin/v2'
import { createEnvelopeFromTemplate } from '@/app/actions/tc-envelopes'
import type { LiveDealCycle } from '@/lib/data/tc/closings'

export function UseFormOnDeal({
  formVersionId,
  formLabel,
  deals,
}: {
  formVersionId: string
  formLabel: string
  deals: LiveDealCycle[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cycleId, setCycleId] = useState(deals[0]?.cycleId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!cycleId) {
      setError('Pick a deal')
      return
    }
    setBusy(true)
    setError(null)
    const res = await createEnvelopeFromTemplate(cycleId, [formVersionId])
    setBusy(false)
    if (!res.ok || !res.envelopeId) {
      setError(res.error ?? 'Could not create envelope')
      return
    }
    setOpen(false)
    router.push(`/admin/signing/${res.envelopeId}`)
  }

  return (
    <>
      <Button
        variant="quiet"
        disabled={!deals.length}
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        Use on deal
      </Button>
      {open ? (
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Use on deal · ${formLabel}`}
        description="Copies this production blank onto the deal as a draft envelope. Review and send from Signing."
        size="work"
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy || !cycleId}>
              {busy ? 'Creating…' : 'Create draft'}
            </Button>
          </>
        }
      >
        {deals.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {deals.map((d) => (
              <ToolbarRadio
                key={d.cycleId}
                name={`deal-${formVersionId}`}
                checked={cycleId === d.cycleId}
                onChange={() => setCycleId(d.cycleId)}
                label={`${d.address} · ${d.stage.replace(/_/g, ' ')}`}
              />
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            No in-flight deals. Open a closing or listing first.
          </p>
        )}
        {error ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p>
        ) : null}
      </Dialog>
      ) : null}
    </>
  )
}
