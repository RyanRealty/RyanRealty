'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCollection } from '@/app/actions/collections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Create a new collection. Inline form that expands from a button so the
 * collections page stays clean when the user is just browsing.
 */
export default function CreateCollectionForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleCreate() {
    if (!name.trim()) {
      setError('Give the collection a name.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createCollection({ name, description })
      if (res.error) {
        setError(res.error)
        return
      }
      setName('')
      setDescription('')
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New collection
      </Button>
    )
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <Label htmlFor="collection-name">Name</Label>
          <Input
            id="collection-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Westside favorites"
            maxLength={80}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="collection-desc">Description (optional)</Label>
          <Input
            id="collection-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Homes near the Old Mill"
            maxLength={160}
            className="mt-1"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleCreate} disabled={pending}>
            {pending ? 'Creating…' : 'Create'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
