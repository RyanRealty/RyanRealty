'use client'

// @no-parity — internal admin tool (TC envelopes & signing)
//
// 11F: off shadcn, onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only —
// createEnvelopeFromDocuments still owns uploaded PDFs. Form library calls
// createEnvelopeFromTemplate (production blanks only). Guards, error strings
// and router.push to the composer are unchanged.
//
// The five Badge fills became StateWords: an envelope status IS a status, which
// is what .av2-state is for (text plus colour, never colour alone). The
// signed/recipient count beside it stays plain tabular text — a count is data,
// and data never goes in a state word.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Dialog, StateWord, TextField, ToolbarCheck, type AdminState } from '@/components/admin/v2'
import {
  createEnvelopeFromDocuments,
  createEnvelopeFromTemplate,
  type EnvelopeSummary,
} from '@/app/actions/tc-envelopes'
import { ENVELOPE_STATUS_LABEL, type EnvelopeStatus } from '@/lib/tc/signing'

type EnvelopeTemplateOption = {
  id: string
  name: string
  formNumber: string | null
  libraryCode: string
}

export type DealEnvelopesCycle = {
  cycleId: string
  label: string
  documents: { id: string; name: string }[]
  envelopes: EnvelopeSummary[]
}

/** One for one with the shadcn fills it replaces: muted → waiting, primary →
 *  accent, warning → slow, success → ok, destructive → down. */
const STATUS_STATE: Record<EnvelopeStatus, AdminState> = {
  draft: 'waiting',
  sent: 'accent',
  partially_signed: 'slow',
  awaiting_other_side: 'slow',
  completed: 'ok',
  voided: 'down',
}

export function DealEnvelopes({
  cycles,
  templates,
}: {
  cycles: DealEnvelopesCycle[]
  templates: EnvelopeTemplateOption[]
}) {
  return (
    <div className="av2-pane">
      <p style={{ margin: 0, fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
        Envelopes &amp; signing
      </p>
      {cycles.map((c) => (
        <CycleEnvelopes key={c.cycleId} cycle={c} templates={templates} />
      ))}
    </div>
  )
}

function CycleEnvelopes({
  cycle,
  templates,
}: {
  cycle: DealEnvelopesCycle
  templates: EnvelopeTemplateOption[]
}) {
  return (
    <div
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-md)',
        padding: 'var(--a-s3)',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ margin: 0, color: 'var(--a-text-2)' }}
        >
          {cycle.label}
        </p>
        <NewEnvelopeDialog cycle={cycle} templates={templates} />
      </div>
      {cycle.envelopes.length ? (
        <ul className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {cycle.envelopes.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-2"
              style={{ fontSize: 'var(--a-text-md)' }}
            >
              <Link
                href={`/admin/signing/${e.id}`}
                className="min-w-0 flex-1 truncate hover:underline"
                style={{ color: 'var(--a-text)' }}
              >
                {e.name}
              </Link>
              <span
                className="shrink-0"
                style={{
                  fontSize: 'var(--a-text-xs)',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--a-text-2)',
                }}
              >
                {e.signedCount}/{e.recipientCount}
              </span>
              <StateWord state={STATUS_STATE[e.status]}>{ENVELOPE_STATUS_LABEL[e.status]}</StateWord>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>No envelopes yet.</p>
      )}
    </div>
  )
}

function NewEnvelopeDialog({
  cycle,
  templates,
}: {
  cycle: DealEnvelopesCycle
  templates: EnvelopeTemplateOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<'docs' | 'library'>('docs')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = source === 'docs' ? cycle.documents : templates.map((t) => ({
    id: t.id,
    name: `${t.libraryCode} ${t.formNumber ?? ''} ${t.name}`.replace(/\s+/g, ' ').trim(),
  }))
  const canOpen = cycle.documents.length > 0 || templates.length > 0

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function switchSource(next: 'docs' | 'library') {
    setSource(next)
    setPicked(new Set())
    setError(null)
  }

  async function create() {
    if (!picked.size) {
      setError(source === 'library' ? 'Pick at least one form' : 'Pick at least one document')
      return
    }
    setBusy(true)
    setError(null)
    const res =
      source === 'library'
        ? await createEnvelopeFromTemplate(cycle.cycleId, [...picked], name.trim() || undefined)
        : await createEnvelopeFromDocuments(cycle.cycleId, [...picked], name.trim() || undefined)
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
      <Button variant="quiet" disabled={!canOpen} onClick={() => setOpen(true)}>
        New envelope
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`New envelope · ${cycle.label}`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy || !picked.size}>
              {busy ? 'Creating…' : 'Create &amp; compose'}
            </Button>
          </>
        }
      >
        <TextField
          label="Envelope name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant={source === 'docs' ? 'primary' : 'quiet'} onClick={() => switchSource('docs')}>
            Uploaded PDFs
          </Button>
          <Button variant={source === 'library' ? 'primary' : 'quiet'} onClick={() => switchSource('library')}>
            Form library
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {source === 'library'
            ? 'Copy licensed blanks onto this deal as a draft envelope. Review and send from Signing. Samples are omitted.'
            : 'Pick the PDF documents already on this cycle to send for signature.'}
        </p>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {rows.length ? (
            rows.map((d) => (
              <ToolbarCheck
                key={d.id}
                checked={picked.has(d.id)}
                onChange={() => toggle(d.id)}
                style={{ marginTop: 2 }}
                // The label element IS the row, so the box lives on it. No
                // background here on purpose: .av2-check:hover paints one, and
                // an inline background would outrank the stylesheet and leave
                // the row dead under the pointer.
                labelStyle={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--a-s2)',
                  margin: 0,
                  padding: 'var(--a-s2)',
                  border: '1px solid var(--a-border)',
                  borderRadius: 'var(--a-r-md)',
                  fontSize: 'var(--a-text-md)',
                  fontWeight: 400,
                }}
                label={
                  <span className="min-w-0 break-words" style={{ color: 'var(--a-text)' }}>
                    {d.name}
                  </span>
                }
              />
            ))
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {source === 'library'
                ? 'No production blanks in the catalog yet. Ingest a current published form, or use an uploaded PDF.'
                : 'No documents on this cycle yet. Upload one first, or use Form library.'}
            </p>
          )}
        </div>
        {error ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p>
        ) : null}
      </Dialog>
    </>
  )
}
