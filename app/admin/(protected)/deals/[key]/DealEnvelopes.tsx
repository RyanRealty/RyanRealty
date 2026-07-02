'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { createEnvelopeFromDocuments, type EnvelopeSummary } from '@/app/actions/tc-envelopes'
import { ENVELOPE_STATUS_LABEL, type EnvelopeStatus } from '@/lib/tc/signing'

export type DealEnvelopesCycle = {
  cycleId: string
  label: string
  documents: { id: string; name: string }[]
  envelopes: EnvelopeSummary[]
}

const STATUS_STYLE: Record<EnvelopeStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/15 text-primary',
  partially_signed: 'bg-warning/20 text-warning-foreground',
  completed: 'bg-success/20 text-success-foreground',
  voided: 'bg-destructive/15 text-destructive',
}

export function DealEnvelopes({ cycles }: { cycles: DealEnvelopesCycle[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Envelopes &amp; signing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cycles.map((c) => (
          <CycleEnvelopes key={c.cycleId} cycle={c} />
        ))}
      </CardContent>
    </Card>
  )
}

function CycleEnvelopes({ cycle }: { cycle: DealEnvelopesCycle }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cycle.label}</p>
        <NewEnvelopeDialog cycle={cycle} />
      </div>
      {cycle.envelopes.length ? (
        <ul className="space-y-1.5">
          {cycle.envelopes.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <Link href={`/admin/signing/${e.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">
                {e.name}
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {e.signedCount}/{e.recipientCount}
              </span>
              <Badge className={STATUS_STYLE[e.status]}>{ENVELOPE_STATUS_LABEL[e.status]}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No envelopes yet.</p>
      )}
    </div>
  )
}

function NewEnvelopeDialog({ cycle }: { cycle: DealEnvelopesCycle }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function create() {
    if (!picked.size) {
      setError('Pick at least one document')
      return
    }
    setBusy(true)
    setError(null)
    const res = await createEnvelopeFromDocuments(cycle.cycleId, [...picked], name.trim() || undefined)
    setBusy(false)
    if (!res.ok || !res.envelopeId) {
      setError(res.error ?? 'Could not create envelope')
      return
    }
    setOpen(false)
    router.push(`/admin/signing/${res.envelopeId}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!cycle.documents.length}>
          New envelope
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>New envelope · {cycle.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Envelope name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-muted-foreground">Pick the PDF documents to send for signature.</p>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {cycle.documents.length ? (
              cycle.documents.map((d) => (
                <Label key={d.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm font-normal">
                  <Checkbox checked={picked.has(d.id)} onCheckedChange={() => toggle(d.id)} className="mt-0.5" />
                  <span className="min-w-0 break-words text-foreground">{d.name}</span>
                </Label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No documents on this cycle yet. Upload one first.</p>
            )}
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={create} disabled={busy || !picked.size}>
            {busy ? 'Creating…' : 'Create &amp; compose'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
