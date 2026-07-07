'use client'

/**
 * AssignBrokerDialog — assigns the CRM contact behind a subscription to a
 * broker. Subscription rows carry no broker column; attribution and the report
 * send engine resolve from crm_people.assigned_broker, so that is the write.
 * Disabled state (no linked contact) is handled by the caller.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  assignSubscriptionBrokerAction,
  getSubscriptionEditOptionsAction,
} from '@/app/actions/subscriptions-admin'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign broker</DialogTitle>
          <DialogDescription>
            Future emails for {contactLabel} attribute to the assigned broker.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label>Broker</Label>
          {loadState === 'loading' ? (
            <Skeleton className="h-9 w-full" />
          ) : loadState === 'error' ? (
            <p className="text-sm text-destructive" role="alert">Could not load the broker roster.</p>
          ) : (
            <Select value={selected} onValueChange={setSelected} disabled={pending}>
              <SelectTrigger className="w-full" aria-label="Broker">
                <SelectValue placeholder="Pick a broker" />
              </SelectTrigger>
              <SelectContent>
                {brokers.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {dialogError && (
            <p className="text-sm text-destructive" role="alert">{dialogError}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending || loadState !== 'ready'}>
            {pending ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
