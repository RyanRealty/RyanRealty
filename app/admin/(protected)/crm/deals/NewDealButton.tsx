'use client'

/**
 * NewDealButton — inline dialog for creating a new crm_deals row.
 * Opens a small Dialog (not a Sheet) to keep it lightweight.
 * On success, navigates to the new deal's detail page.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createCrmDeal } from '@/app/actions/crm-deals'

type Props = {
  className?: string
}

export function NewDealButton({ className }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpen() {
    setName('')
    setError(null)
    setOpen(true)
  }

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Deal name is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createCrmDeal({ name: trimmed })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      if (res.id) {
        router.push(`/admin/crm/deals/${res.id}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        className={className}
        onClick={handleOpen}
      >
        + New deal
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New deal</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-deal-name">Deal name</Label>
              <Input
                id="new-deal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Smith — 123 Main St"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              onClick={handleCreate}
            >
              {pending ? 'Creating…' : 'Create deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
