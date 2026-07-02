'use client'

/**
 * AddPersonDialog — the §16 Add Person modal
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * Minimal quick-create: First/Last name (50/50 row), Email, Phone, lead-source
 * dropdown. "Add person" (lowercase p, §16.5 label correction) is disabled
 * until a first name is entered; submit routes through createCrmContactAction
 * (FUB event + local mirror + dedupe) and navigates to the new Person Detail.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserRoundPlus } from 'lucide-react'
import { createCrmContactAction } from '@/app/actions/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export type AddPersonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Configured lead sources for the §16 dropdown. */
  sources: Array<{ key: string; label: string }>
}

export default function AddPersonDialog({ open, onOpenChange, sources }: AddPersonDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setSource(''); setError(null)
  }

  const submit = () => {
    setError(null)
    const fd = new FormData()
    fd.set('firstName', firstName.trim())
    fd.set('lastName', lastName.trim())
    fd.set('email', email.trim())
    fd.set('phone', phone.trim())
    if (source) fd.set('source', source)
    startTransition(async () => {
      const res = await createCrmContactAction(fd)
      if (!res.ok) { setError(res.error ?? 'Could not add the person'); return }
      reset()
      onOpenChange(false)
      if (res.personId) router.push(`/admin/crm/${res.personId}`)
      else router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="h-4 w-4" aria-hidden />
            Add Person
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ap-first" className="mb-1.5 block text-xs text-muted-foreground">First Name</Label>
              <Input id="ap-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" className="h-9" />
            </div>
            <div>
              <Label htmlFor="ap-last" className="mb-1.5 block text-xs text-muted-foreground">Last Name</Label>
              <Input id="ap-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" className="h-9" />
            </div>
          </div>
          <div>
            <Label htmlFor="ap-email" className="mb-1.5 block text-xs text-muted-foreground">Email</Label>
            <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className="h-9" />
          </div>
          <div>
            <Label htmlFor="ap-phone" className="mb-1.5 block text-xs text-muted-foreground">Phone</Label>
            <Input id="ap-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" className="h-9" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Lead source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select a lead source" /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            An email or a phone number is required. If the person already exists, this updates them instead of creating a duplicate.
          </p>
          {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={isPending || !firstName.trim()}>
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
            Add person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
