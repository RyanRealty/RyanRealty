'use client'

/**
 * Per-subscriber Edit + Delete controls. Edit covers name, segment, status,
 * and broker reassignment (writes the linked CRM person's assigned_broker —
 * the next issue re-brands to the new broker; past-issue analytics stay
 * frozen). Delete confirms in a Dialog; deleting a non-active row additionally
 * requires acknowledging that it erases the opt-out record (S-10).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminDeleteSubscriberAction, adminEditSubscriberAction } from '@/app/admin/(protected)/newsletters/actions'

const SEGMENTS = [
  { value: 'general', label: 'General' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'past-client', label: 'Past client' },
]
const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
]
const BROKERS = [
  { value: 'matt', label: 'Matt' },
  { value: 'rebecca', label: 'Rebecca' },
  { value: 'paul', label: 'Paul' },
]

type Props = {
  id: string
  email: string
  name: string | null
  segment: string
  status: string
  broker: string
  hasCrmPerson: boolean
}

export default function SubscriberRowActions({ id, email, name, segment, status, broker, hasCrmPerson }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editName, setEditName] = useState(name ?? '')
  const [editSegment, setEditSegment] = useState(segment)
  const [editStatus, setEditStatus] = useState(status)
  const [editBroker, setEditBroker] = useState(broker)
  const [ackOptOut, setAckOptOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOptOutRecord = status !== 'active'

  function onSave() {
    setError(null)
    startTransition(async () => {
      const r = await adminEditSubscriberAction(id, {
        name: editName,
        segment: editSegment,
        status: (editStatus === 'active' || editStatus === 'unsubscribed') ? (editStatus as 'active' | 'unsubscribed') : undefined,
        broker: hasCrmPerson && editBroker !== broker ? editBroker : undefined,
      })
      if (r.ok) {
        setEditOpen(false)
        router.refresh()
      } else {
        const map: Record<string, string> = {
          no_crm_person: 'Saved, but the broker could not change: this subscriber is not linked to a CRM contact.',
          unauthorized: 'You do not have access to edit subscribers.',
          persist_failed: 'Could not save the changes.',
        }
        setError(map[r.error ?? ''] ?? r.error ?? 'Could not save the changes.')
      }
    })
  }

  function onDelete() {
    setError(null)
    startTransition(async () => {
      const r = await adminDeleteSubscriberAction(id, { confirmOptOutRemoval: ackOptOut })
      if (r.ok) {
        setDeleteOpen(false)
        router.refresh()
      } else {
        const map: Record<string, string> = {
          opt_out_record: 'This row records an opt-out. Check the acknowledgment box to delete it anyway.',
          unauthorized: 'You do not have access to delete subscribers.',
        }
        setError(map[r.error ?? ''] ?? r.error ?? 'Could not delete the subscriber.')
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => { setError(null); setEditOpen(true) }}>
        Edit
      </Button>
      <Button type="button" size="sm" variant="destructive" onClick={() => { setError(null); setAckOptOut(false); setDeleteOpen(true) }}>
        Delete
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subscriber</DialogTitle>
            <DialogDescription>{email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-name-${id}`}>Name</Label>
              <Input id={`edit-name-${id}`} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`edit-segment-${id}`}>Segment</Label>
                <Select value={editSegment} onValueChange={setEditSegment}>
                  <SelectTrigger id={`edit-segment-${id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`edit-status-${id}`}>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id={`edit-status-${id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                    {status !== 'active' && status !== 'unsubscribed' ? (
                      <SelectItem value={status} disabled>{status}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`edit-broker-${id}`}>Broker</Label>
                <Select value={editBroker} onValueChange={setEditBroker} disabled={!hasCrmPerson}>
                  <SelectTrigger id={`edit-broker-${id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BROKERS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!hasCrmPerson ? (
                  <p className="text-xs text-muted-foreground">Not linked to a CRM contact, so broker follows the default (Matt).</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Reassigning moves the linked CRM contact to this broker. Their next issue re-brands.</p>
                )}
              </div>
            </div>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this subscriber?</DialogTitle>
            <DialogDescription>
              {email} is removed from the list entirely. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {isOptOutRecord ? (
            <div className="flex items-start gap-2 py-2">
              <Checkbox id={`ack-${id}`} checked={ackOptOut} onCheckedChange={(v) => setAckOptOut(v === true)} />
              <Label htmlFor={`ack-${id}`} className="text-sm font-normal leading-snug text-muted-foreground">
                I understand this row records an opt-out ({status}) and deleting it erases that record. If this address is
                enrolled again later, the system will treat it as new.
              </Label>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending || (isOptOutRecord && !ackOptOut)}>
              {pending ? 'Deleting…' : 'Delete subscriber'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
