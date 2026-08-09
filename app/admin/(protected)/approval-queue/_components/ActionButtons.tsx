'use client'

/**
 * ActionButtons — approve / schedule / request-changes / reject / duplicate / run-producer
 * controls for one marketing_brain_actions row.
 *
 * 11F: off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — the same fetch bodies,
 * the same status hand-offs to onStatusChange, the same toast timings and every
 * visible string are carried over verbatim. Approving still hits the publisher
 * sweep path (CLAUDE.md §1); nothing here changes what each action does.
 *
 * Mapping: Button outline/ghost -> quiet; destructive -> danger; success-green
 * "Approve and ship now" -> the one primary (ADMIN_UI: green is status, not CTA);
 * Dialog/DialogContent/… -> the v2 Dialog (platform <dialog>); Input+Label ->
 * TextField; Textarea+Label -> TextAreaField; Select+… -> SelectField (native
 * <select>, empty-value options keep the same values); Alert -> a token-styled
 * role="alert" box (same call BulkSelection recorded).
 *
 * Exactly one primary Button in the file ("Approve and ship now") — ci:admin-ui
 * rule C. Dialog confirms that are not destructive stay quiet next to a quiet
 * Cancel; reject confirm is danger.
 */

import { useState } from 'react'
import { Button, Dialog, SelectField, TextAreaField, TextField } from '@/components/admin/v2'

interface ActionButtonsProps {
  actionId: string
  producerSlug: string
  status?: string
  onStatusChange?: (newStatus: string) => void
}

type DialogMode =
  | 'schedule'
  | 'request_changes'
  | 'reject'
  | 'duplicate'
  | null

export function ActionButtons({ actionId, producerSlug, status, onStatusChange }: ActionButtonsProps) {
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  // Dialog form state
  const [scheduledFor, setScheduledFor] = useState('')
  const [changeBody, setChangeBody] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [duplicateMode, setDuplicateMode] = useState<'same_producer' | 'new_producer'>('same_producer')
  const [duplicatePayloadNotes, setDuplicatePayloadNotes] = useState('')

  function showToast(msg: string, isError = false) {
    setToast(msg)
    setToastError(isError)
    setTimeout(() => setToast(''), 4000)
  }

  async function callApi(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/approval-queue/${actionId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`)
    return j
  }

  async function approveNow() {
    setBusy(true)
    try {
      await callApi({ action: 'approve_now' })
      showToast('Approved. Publisher will pick this up on the next sweep.')
      onStatusChange?.('approved')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', true)
    } finally {
      setBusy(false)
    }
  }

  async function approveScheduled() {
    if (!scheduledFor) return
    setBusy(true)
    try {
      await callApi({ action: 'approve_schedule', scheduled_for: scheduledFor })
      showToast('Scheduled. The post_scheduler skill will publish at the selected time.')
      onStatusChange?.('approved')
      setDialog(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', true)
    } finally {
      setBusy(false)
    }
  }

  async function requestChanges() {
    if (!changeBody.trim()) return
    setBusy(true)
    try {
      await callApi({ action: 'request_changes', change_body: changeBody.trim() })
      showToast('Change request filed. Producer will re-draft.')
      onStatusChange?.('needs_changes')
      setDialog(null)
      setChangeBody('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', true)
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!rejectReason.trim()) return
    setBusy(true)
    try {
      await callApi({ action: 'reject', killed_reason: rejectReason.trim() })
      showToast('Action killed.')
      onStatusChange?.('killed')
      setDialog(null)
      setRejectReason('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', true)
    } finally {
      setBusy(false)
    }
  }

  async function duplicate() {
    setBusy(true)
    try {
      await callApi({
        action: 'duplicate',
        mode: duplicateMode,
        producer_slug: producerSlug,
        notes: duplicatePayloadNotes.trim(),
      })
      showToast(
        duplicateMode === 'new_producer'
          ? 'Producer change request filed. Check the Producer Catalog to review.'
          : 'New pending action row created.',
      )
      setDialog(null)
      setDuplicatePayloadNotes('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', true)
    } finally {
      setBusy(false)
    }
  }

  async function runProducer() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/run-producer/${actionId}`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = j?.error ?? `HTTP ${res.status}`
        if (j?.requires_billing_action) {
          showToast(
            `Anthropic billing issue: ${msg}. Check your API key balance at console.anthropic.com.`,
            true,
          )
        } else {
          showToast(msg, true)
        }
        return
      }
      showToast(`Producer ran. Row is now 'ready' for your approval. Cost: $${(j.cost_usd ?? 0).toFixed(4)}`)
      onStatusChange?.('ready')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', true)
    } finally {
      setBusy(false)
    }
  }

  function closeDialog() {
    setDialog(null)
  }

  return (
    <>
      {toast && (
        <div
          role="alert"
          className="mb-3 px-2.5 py-2"
          style={{
            background: 'var(--a-bg)',
            border: `1px solid ${toastError ? 'var(--a-danger)' : 'var(--a-border)'}`,
            borderRadius: 'var(--a-r-lg)',
            fontSize: 'var(--a-text-sm)',
            color: toastError ? 'var(--a-danger)' : 'var(--a-text)',
          }}
        >
          {toast}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(status === 'pending' || status === 'in_production') && (
          <Button variant="quiet" onClick={runProducer} disabled={busy}>
            Run producer now
          </Button>
        )}
        {/* The one primary in this file — ci:admin-ui rule C */}
        <Button onClick={approveNow} disabled={busy}>
          Approve and ship now
        </Button>
        <Button variant="quiet" onClick={() => setDialog('schedule')} disabled={busy}>
          Approve and schedule
        </Button>
        <Button variant="quiet" onClick={() => setDialog('request_changes')} disabled={busy}>
          Request changes
        </Button>
        <Button variant="quiet" onClick={() => setDialog('duplicate')} disabled={busy}>
          Duplicate as new variant
        </Button>
        <Button variant="danger" onClick={() => setDialog('reject')} disabled={busy}>
          Reject
        </Button>
      </div>

      <Dialog
        open={dialog === 'schedule'}
        onClose={closeDialog}
        title="Schedule this post"
        footer={
          <>
            <Button variant="quiet" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={approveScheduled} disabled={busy || !scheduledFor}>
              {busy ? 'Scheduling...' : 'Schedule'}
            </Button>
          </>
        }
      >
        <TextField
          label="Date and time (Mountain Time)"
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          The post_scheduler skill publishes at this time. Confirm your timezone is set to
          Mountain Time in your OS, or adjust accordingly.
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'request_changes'}
        onClose={closeDialog}
        title="Request changes"
        footer={
          <>
            <Button variant="quiet" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="quiet"
              onClick={requestChanges}
              disabled={busy || !changeBody.trim()}
            >
              {busy ? 'Submitting...' : 'Send change request'}
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Describe what needs to change"
          placeholder="e.g. Caption is too long. Trim to under 150 characters and remove the third bullet."
          value={changeBody}
          onChange={(e) => setChangeBody(e.target.value)}
          rows={4}
          required
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          This will flip status to needs_changes and notify the producer.
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'reject'}
        onClose={closeDialog}
        title="Reject this action"
        footer={
          <>
            <Button variant="quiet" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={reject}
              disabled={busy || !rejectReason.trim()}
            >
              {busy ? 'Rejecting...' : 'Confirm reject'}
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Reason (required)"
          placeholder="e.g. Market conditions changed. This listing is now off-market."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          required
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          This is permanent. The action will be moved to killed status.
        </p>
      </Dialog>

      <Dialog
        open={dialog === 'duplicate'}
        onClose={closeDialog}
        title="Duplicate as new variant"
        footer={
          <>
            <Button variant="quiet" onClick={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={duplicate} disabled={busy}>
              {busy ? 'Creating...' : 'Create duplicate'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Mode"
            value={duplicateMode}
            onChange={(e) => setDuplicateMode(e.target.value as typeof duplicateMode)}
          >
            <option value="same_producer">Same producer, new payload tweaks</option>
            <option value="new_producer">Spin off as new producer</option>
          </SelectField>
          <TextAreaField
            label={
              duplicateMode === 'new_producer'
                ? 'Describe the new producer you want'
                : 'Describe the payload changes'
            }
            placeholder={
              duplicateMode === 'new_producer'
                ? 'e.g. Same as listing_reveal but for coming-soon listings with exterior-only photos.'
                : 'e.g. Same video but for Sunriver instead of Bend. Change city filter and music bed.'
            }
            value={duplicatePayloadNotes}
            onChange={(e) => setDuplicatePayloadNotes(e.target.value)}
            rows={4}
          />
        </div>
      </Dialog>
    </>
  )
}
