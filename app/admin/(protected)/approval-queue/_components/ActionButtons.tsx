'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

  return (
    <>
      {/* Toast */}
      {toast && (
        <Alert variant={toastError ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{toast}</AlertDescription>
        </Alert>
      )}

      {/* Primary buttons */}
      <div className="flex flex-wrap gap-2">
        {(status === 'pending' || status === 'in_production') && (
          <Button
            size="sm"
            variant="outline"
            onClick={runProducer}
            disabled={busy}
            className="border-primary text-primary hover:bg-primary/10"
          >
            Run producer now
          </Button>
        )}
        <Button
          size="sm"
          onClick={approveNow}
          disabled={busy}
          className="bg-success text-success-foreground hover:bg-success/90"
        >
          Approve and ship now
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog('schedule')}
          disabled={busy}
        >
          Approve and schedule
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog('request_changes')}
          disabled={busy}
        >
          Request changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog('duplicate')}
          disabled={busy}
        >
          Duplicate as new variant
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setDialog('reject')}
          disabled={busy}
        >
          Reject
        </Button>
      </div>

      {/* Approve and schedule dialog */}
      <Dialog open={dialog === 'schedule'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule this post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="sched-dt">Date and time (Mountain Time)</Label>
            <Input
              id="sched-dt"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The post_scheduler skill publishes at this time. Confirm your timezone is set
              to Mountain Time in your OS, or adjust accordingly.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={approveScheduled} disabled={busy || !scheduledFor}>
              {busy ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request changes dialog */}
      <Dialog open={dialog === 'request_changes'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="change-body">Describe what needs to change</Label>
            <Textarea
              id="change-body"
              placeholder="e.g. Caption is too long. Trim to under 150 characters and remove the third bullet."
              value={changeBody}
              onChange={(e) => setChangeBody(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will flip status to needs_changes and notify the producer.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={requestChanges} disabled={busy || !changeBody.trim()}>
              {busy ? 'Submitting...' : 'Send change request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={dialog === 'reject'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="reject-reason">Reason (required)</Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g. Market conditions changed. This listing is now off-market."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
            />
            <p className="text-xs text-destructive">
              This is permanent. The action will be moved to killed status.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={reject}
              disabled={busy || !rejectReason.trim()}
            >
              {busy ? 'Rejecting...' : 'Confirm reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate dialog */}
      <Dialog open={dialog === 'duplicate'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate as new variant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dup-mode">Mode</Label>
              <Select
                value={duplicateMode}
                onValueChange={(v) => setDuplicateMode(v as typeof duplicateMode)}
              >
                <SelectTrigger id="dup-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same_producer">Same producer, new payload tweaks</SelectItem>
                  <SelectItem value="new_producer">Spin off as new producer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dup-notes">
                {duplicateMode === 'new_producer'
                  ? 'Describe the new producer you want'
                  : 'Describe the payload changes'}
              </Label>
              <Textarea
                id="dup-notes"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={duplicate} disabled={busy}>
              {busy ? 'Creating...' : 'Create duplicate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
