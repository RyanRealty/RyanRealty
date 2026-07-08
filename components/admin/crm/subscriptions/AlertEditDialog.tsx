'use client'

/**
 * AlertEditDialog — per-row edit surface for a listing alert inside the admin
 * Alerts & reports hub. The name stays a plain input; every other criterion
 * edits through AlertCriteriaEditor, the sentence-style editor with a live
 * plain-English summary and a live matching-listing count. Filter keys the
 * editor does not expose (keywords, map polygon, extra cities, ...) are
 * preserved untouched on save — the server action merges + re-normalizes
 * through the canonical filter model and keeps filters_hash in sync.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateAlertSubscriptionAction } from '@/app/actions/subscriptions-admin'
import type { AdminAlertSubscriptionRow } from '@/lib/data/crm/subscriptionsAdmin'
import type { SavedSearchFilters } from '@/lib/search-filters'
import { AlertCriteriaEditor, type AlertFrequency } from '@/components/admin/crm/criteria'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {noun}</DialogTitle>
          <DialogDescription>
            {row.email ? `Alerts for ${row.email}. ` : ''}Filters you do not change here are kept as they are.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="alert-edit-name">Name</Label>
            <Input
              id="alert-edit-name"
              value={draftName}
              maxLength={120}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>

          <AlertCriteriaEditor
            value={draftFilters}
            onChange={setDraftFilters}
            frequency={draftFrequency}
            onFrequencyChange={setDraftFrequency}
            disabled={pending}
          />

          {dialogError && (
            <p className="text-sm text-destructive" role="alert">{dialogError}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
