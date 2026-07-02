'use client'

import { useState, useTransition } from 'react'
import { updateSpamLabelAction, updateSubdomainAction } from '@/app/actions/crm-company-settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * The two "(Change)" inline flows on Company Settings:
 *  - SpamLabelChange (spec §1.4 row 12 / AC-6): edits the legal entity name
 *    carriers show for STIR/SHAKEN caller ID; hard-capped at 15 characters.
 *  - SubdomainChange (spec §1.6 / AC-8): warning modal + explicit text input of
 *    the new prefix before saving the stored account subdomain identifier.
 */

function ChangeLink({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="link" className="h-auto p-0 text-sm text-primary" onClick={onClick}>
      (Change)
    </Button>
  )
}

export function SpamLabelChange({ value, onSaved }: { value: string; onSaved: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(value)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    setError('')
    startTransition(async () => {
      try {
        const clean = label.trim().slice(0, 15)
        await updateSpamLabelAction(clean)
        onSaved(clean)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <>
      <ChangeLink onClick={() => { setLabel(value); setOpen(true) }} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Spam label calling protection</DialogTitle>
            <DialogDescription>
              The legal entity name registered with carriers for STIR/SHAKEN caller ID.
              Carriers use the first 15 characters of the legal business name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="spam-label-input">Legal entity name</Label>
            <Input
              id="spam-label-input"
              value={label}
              maxLength={15}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{label.trim().length}/15 characters</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isPending || !label.trim()}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SubdomainChange({ value, onSaved }: { value: string; onSaved: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    setError('')
    startTransition(async () => {
      try {
        const clean = prefix.trim().toLowerCase()
        await updateSubdomainAction(clean)
        onSaved(clean)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  return (
    <>
      <ChangeLink onClick={() => { setPrefix(''); setOpen(true) }} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change account subdomain</DialogTitle>
            <DialogDescription>
              This changes the stored account subdomain identifier. The CRM login URL
              (ryan-realty.com/admin) and existing sessions do not change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="subdomain-input">New subdomain</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="subdomain-input"
                value={prefix}
                placeholder={value}
                onChange={(e) => setPrefix(e.target.value)}
                className="max-w-52"
              />
              <span className="text-sm text-muted-foreground">.ryan-realty.com</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Type the new prefix to confirm. Current: <span className="font-medium text-foreground">{value}</span>
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={isPending || !prefix.trim()}>
              {isPending ? 'Saving...' : 'Confirm change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
