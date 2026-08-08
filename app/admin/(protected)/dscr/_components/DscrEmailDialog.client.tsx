'use client'

/**
 * Stage a selected DSCR deal list as a Gmail draft.
 *
 * Renders the canonical EmailBodyEditor (G50 — one compose interface for every
 * message this shop sends). There is deliberately no send button: the action
 * writes a Gmail draft and Matt sends it from his own mailbox, because an
 * outbound message to a real person is per-action approval under CLAUDE.md §1.
 *
 * The dialog posts listing keys and copy only. Every figure in the email is
 * recomputed server-side from live data, so nothing a browser could tamper with
 * reaches a recipient as a number.
 *
 * 11F: moved here from components/admin/dscr/ and put on the v2 language. The
 * EmailBodyEditor import STAYS pointed at components/admin/crm — that is the
 * G50 chokepoint ci:composer-discipline requires, and forking it to satisfy a
 * color gate would defeat the gate that matters more. This file is therefore
 * deliberately outside ci:admin-v2-tokens' SCAN_DIRS, the same sanctioned call
 * already recorded for people/[id]'s CommsSection and email/compose.
 */

import { useState } from 'react'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { stageDscrDealListDraftAction, type StageDscrDraftResult } from '@/app/actions/dscr-email'
import { Button, Dialog, TextField, VerdictLine } from '@/components/admin/v2'

export function DscrEmailDialog({
  open,
  onOpenChange,
  listingKeys,
  pricedCount,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  listingKeys: string[]
  pricedCount: number
}) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('Central Oregon rentals that pencil at today’s rates')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<StageDscrDraftResult | null>(null)

  const unpriced = listingKeys.length - pricedCount

  async function stage() {
    setBusy(true)
    setResult(null)
    const fd = new FormData()
    fd.set('to', to)
    fd.set('subject', subject)
    fd.set('body', body)
    fd.set('listingKeys', listingKeys.join(','))
    try {
      setResult(await stageDscrDealListDraftAction(fd))
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Could not stage the draft.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={`Email ${listingKeys.length} ${listingKeys.length === 1 ? 'property' : 'properties'}`}
      description="This creates a draft in your Gmail. Nothing is sent until you open it and send it yourself. Every figure is recomputed from live data when the draft is written."
      footer={
        <Button onClick={stage} disabled={busy || !to || listingKeys.length === 0}>
          {busy ? 'Creating draft…' : 'Create Gmail draft'}
        </Button>
      }
    >
      {unpriced > 0 ? (
        <VerdictLine tone="attention">
          {unpriced} of the selected {unpriced === 1 ? 'property has' : 'properties have'} no rent
          estimate and will be left out, since there is nothing accurate to say about{' '}
          {unpriced === 1 ? 'it' : 'them'}.
        </VerdictLine>
      ) : null}

      <TextField
        label="To"
        type="email"
        placeholder="investor@example.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />

      <EmailBodyEditor
        subject={subject}
        onSubjectChange={setSubject}
        body={body}
        onBodyChange={setBody}
        hideMergeFields
        bodyPlaceholder="Optional note above the property list."
      />

      {result ? (
        <VerdictLine tone={result.ok ? 'ok' : 'attention'}>
          {result.ok ? (
            <>
              Draft created for {result.recipient} with {result.count}{' '}
              {result.count === 1 ? 'property' : 'properties'}
              {result.dropped > 0
                ? ` (${result.dropped} left out for want of a rent estimate)`
                : ''}
              . Open Gmail to review and send.
            </>
          ) : (
            result.error
          )}
        </VerdictLine>
      ) : null}
    </Dialog>
  )
}
