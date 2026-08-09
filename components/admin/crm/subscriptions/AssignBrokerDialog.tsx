'use client'

/**
 * AssignBrokerDialog — assigns the CRM contact behind a subscription to a
 * broker. Subscription rows carry no broker column; attribution and the report
 * send engine resolve from crm_people.assigned_broker, so that is the write.
 * Disabled state (no linked contact) is handled by the caller.
 *
 * P11F: on the LOCKED admin v2 language — the v2 Dialog, SelectField (which
 * owns the "Broker" label and its htmlFor, replacing the shadcn Label +
 * aria-label pair), an av2-rskel row for the roster load, and v2 Buttons.
 * "Assign" is this file's one primary.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  assignSubscriptionBrokerAction,
  getSubscriptionEditOptionsAction,
} from '@/app/actions/subscriptions-admin'
import { Button, Dialog, SelectField } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

export default function AssignBrokerDialog({
  personId,
  contactLabel,
  currentBroker,
  onClose,
  onSaved,
}: {
  personId: number
  contactLabel: string
  currentBroker: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [brokers, setBrokers] = useState<Array<{ slug: string, name: string }>>([])
  const [selected, setSelected] = useState(currentBroker ?? '')
  const [dialogError, setDialogError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getSubscriptionEditOptionsAction()
      if (cancelled) return
      if (!res.data) {
        setLoadState('error')
        return
      }
      setBrokers(res.data.brokers)
      setLoadState('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function handleSave() {
    if (!selected) {
      setDialogError('Pick a broker.')
      return
    }
    setDialogError('')
    startTransition(async () => {
      const res = await assignSubscriptionBrokerAction(personId, selected)
      if (!res.data) {
        setDialogError(res.error ?? 'Could not assign that broker')
        return
      }
      toast.success(`Assigned to ${brokers.find((b) => b.slug === selected)?.name ?? selected}`)
      onSaved()
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Assign broker"
      description={`Future emails for ${contactLabel} attribute to the assigned broker.`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || loadState !== 'ready'}>
            {pending ? 'Assigning...' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="grid gap-1.5">
        {loadState === 'ready' ? (
          <SelectField
            label="Broker"
            value={selected}
            disabled={pending}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="" disabled>Pick a broker</option>
            {brokers.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </SelectField>
        ) : (
          <>
            <span className="av2-field__label">Broker</span>
            {loadState === 'loading' ? (
              <div className="av2-rskel__row" style={{ height: 36, margin: 0 }} aria-hidden="true" />
            ) : (
              <p className="text-sm" style={{ color: 'var(--a-danger)' }} role="alert">Could not load the broker roster.</p>
            )}
          </>
        )}
        {dialogError && (
          <p className="text-sm" style={{ color: 'var(--a-danger)' }} role="alert">{dialogError}</p>
        )}
      </div>
    </Dialog>
  )
}
