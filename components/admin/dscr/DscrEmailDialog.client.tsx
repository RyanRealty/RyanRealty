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
 */

import { useState } from 'react'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { stageDscrDealListDraftAction, type StageDscrDraftResult } from '@/app/actions/dscr-email'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email {listingKeys.length} {listingKeys.length === 1 ? 'property' : 'properties'}</DialogTitle>
          <DialogDescription>
            This creates a draft in your Gmail. Nothing is sent until you open it and send it yourself.
            Every figure is recomputed from live data when the draft is written.
          </DialogDescription>
        </DialogHeader>

        {unpriced > 0 ? (
          <Alert>
            <AlertDescription>
              {unpriced} of the selected {unpriced === 1 ? 'property has' : 'properties have'} no rent estimate
              and will be left out, since there is nothing accurate to say about {unpriced === 1 ? 'it' : 'them'}.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="dscr-to">To</Label>
          <Input
            id="dscr-to"
            type="email"
            placeholder="investor@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <EmailBodyEditor
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          hideMergeFields
          bodyPlaceholder="Optional note above the property list."
        />

        {result ? (
          <Alert variant={result.ok ? 'default' : 'destructive'}>
            <AlertDescription>
              {result.ok ? (
                <>
                  Draft created for {result.recipient} with {result.count}{' '}
                  {result.count === 1 ? 'property' : 'properties'}
                  {result.dropped > 0 ? ` (${result.dropped} left out for want of a rent estimate)` : ''}.
                  Open Gmail to review and send.
                </>
              ) : (
                result.error
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={stage} disabled={busy || !to || listingKeys.length === 0}>
            {busy ? 'Creating draft…' : 'Create Gmail draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
