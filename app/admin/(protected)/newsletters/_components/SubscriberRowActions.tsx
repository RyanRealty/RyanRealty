'use client'

/**
 * Per-subscriber Edit + Delete controls. Edit covers name, segment, status,
 * and broker reassignment (writes the linked CRM person's assigned_broker —
 * the next issue re-brands to the new broker; past-issue analytics stay
 * frozen). Delete confirms in a Dialog; deleting a non-active row additionally
 * requires acknowledging that it erases the opt-out record (S-10).
 *
 * Admin v2 (11F): shadcn Dialog/Select/Input/Label/Checkbox/Button replaced by
 * the locked admin language. The delete confirm keeps its custom disabled
 * logic (blocked until the opt-out is acknowledged) so it uses the base
 * <Dialog>, not <ConfirmDialog> — ConfirmDialog's confirm button only accepts
 * a `busy` flag, which would also disable Cancel while the checkbox is
 * unchecked. ci:admin-ui rule C allows one primary Button per file; "Save
 * changes" keeps it, "Edit" is quiet and "Delete" / "Delete subscriber" are
 * danger — the honest read for a destructive, compliance-sensitive action.
 * Presentation only: same actions, same FormData fields, same status/segment/
 * broker mapping, same opt-out acknowledgment gate, same strings.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, SelectField, TextField, ToolbarCheck } from '@/components/admin/v2'
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
      <Button type="button" variant="quiet" onClick={() => { setError(null); setEditOpen(true) }}>
        Edit
      </Button>
      <Button type="button" variant="danger" onClick={() => { setError(null); setAckOptOut(false); setDeleteOpen(true) }}>
        Delete
      </Button>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit subscriber"
        description={email}
        size="work"
        footer={
          <>
            <Button type="button" variant="quiet" onClick={() => setEditOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        <TextField label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Optional" />
        <div className="av2-editgrid">
          <SelectField label="Segment" value={editSegment} onChange={(e) => setEditSegment(e.target.value)}>
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            {status !== 'active' && status !== 'unsubscribed' ? (
              <option value={status} disabled>
                {status}
              </option>
            ) : null}
          </SelectField>
          <div>
            <SelectField
              label="Broker"
              value={editBroker}
              onChange={(e) => setEditBroker(e.target.value)}
              disabled={!hasCrmPerson}
            >
              {BROKERS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </SelectField>
            {!hasCrmPerson ? (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                Not linked to a CRM contact, so broker follows the default (Matt).
              </p>
            ) : (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                Reassigning moves the linked CRM contact to this broker. Their next issue re-brands.
              </p>
            )}
          </div>
        </div>
        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
            {error}
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this subscriber?"
        description={<>{email} is removed from the list entirely. This cannot be undone.</>}
        footer={
          <>
            <Button type="button" variant="quiet" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onDelete} disabled={pending || (isOptOutRecord && !ackOptOut)}>
              {pending ? 'Deleting…' : 'Delete subscriber'}
            </Button>
          </>
        }
      >
        {isOptOutRecord ? (
          <ToolbarCheck
            checked={ackOptOut}
            onChange={(e) => setAckOptOut(e.target.checked)}
            label={
              <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                I understand this row records an opt-out ({status}) and deleting it erases that record. If this address is
                enrolled again later, the system will treat it as new.
              </span>
            }
          />
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
            {error}
          </p>
        ) : null}
      </Dialog>
    </div>
  )
}
