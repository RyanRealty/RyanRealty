'use client'

/**
 * AlertEditDialog — per-row edit surface for a listing alert inside the admin
 * Alerts & reports hub. The name stays a plain input; every other criterion
 * edits through AlertCriteriaEditor, the sentence-style editor with a live
 * plain-English summary and a live matching-listing count. Filter keys the
 * editor does not expose (keywords, map polygon, extra cities, ...) are
 * preserved untouched on save — the server action merges + re-normalizes
 * through the canonical filter model and keeps filters_hash in sync.
 *
 * P11F: on the LOCKED admin v2 language — the shadcn Dialog/Input/Label/Button
 * became the v2 Dialog, TextField (which owns its own label + htmlFor) and v2
 * Buttons. "Save changes" is this file's one primary; Cancel is quiet.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateAlertSubscriptionAction } from '@/app/actions/subscriptions-admin'
import type { AdminAlertSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
import type { SavedSearchFilters } from '@/lib/search-filters'
import { AlertCriteriaEditor, type AlertFrequency } from '@/components/admin/crm/criteria'
import { Button, Dialog, TextField } from '@/components/admin/v2'

function normalizeAlertFrequency(f: string): AlertFrequency {
  const v = f.trim().toLowerCase()
  if (v === 'instant' || v === 'weekly') return v
  return 'daily'
}

export default function AlertEditDialog({
  row,
  onClose,
  onSaved,
}: {
  /** The row being edited. The dialog is mounted only while open. */
  row: AdminAlertSubscriptionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [draftName, setDraftName] = useState(row.name ?? '')
  const [draftFilters, setDraftFilters] = useState<SavedSearchFilters>(
    (row.filters ?? {}) as SavedSearchFilters,
  )
  const [draftFrequency, setDraftFrequency] = useState<AlertFrequency>(
    normalizeAlertFrequency(row.frequency),
  )
  const [dialogError, setDialogError] = useState('')

  const noun = row.kind === 'guest' ? 'alert' : 'saved search'

  function handleSave() {
    setDialogError('')
    startTransition(async () => {
      const res = await updateAlertSubscriptionAction(row.kind, row.id, {
        name: draftName.trim() || (row.name ?? undefined),
        frequency: draftFrequency,
        filters: draftFilters,
      })
      if (!res.data) {
        setDialogError(res.error ?? 'Could not save those changes')
        return
      }
      toast.success(`Saved the ${noun}`)
      onSaved()
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${noun}`}
      size="work"
      description={
        <>
          {row.email ? `Alerts for ${row.email}. ` : ''}Filters you do not change here are kept as they are.
        </>
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {/* No `id` prop: TextField mints its own and points its <label> at it,
            so passing one would break the htmlFor pairing. */}
        <TextField
          label="Name"
          value={draftName}
          maxLength={120}
          onChange={(e) => setDraftName(e.target.value)}
        />

        <AlertCriteriaEditor
          value={draftFilters}
          onChange={setDraftFilters}
          frequency={draftFrequency}
          onFrequencyChange={setDraftFrequency}
          disabled={pending}
        />

        {dialogError && (
          <p className="text-sm" style={{ color: 'var(--a-danger)' }} role="alert">{dialogError}</p>
        )}
      </div>
    </Dialog>
  )
}
