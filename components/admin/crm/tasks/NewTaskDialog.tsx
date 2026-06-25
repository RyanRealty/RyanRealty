'use client'

/**
 * NewTaskDialog — create a task from the queue (Wave 7). Contact is optional (a
 * standalone reminder is allowed). Posts through the EXISTING addCrmTaskAction
 * (FormData), passed in pre-bound. The action requires a personId, so this
 * dialog only enables submission once a contact id is entered.
 *
 * NOTE: addCrmTaskAction currently requires a contact. Until a person-less task
 * is supported by the action, the contact field is required here and the helper
 * text says so. The lookup is by CRM person id (the same id the contact card URL
 * uses), keeping this dependency-free of a contact search component.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CrmTaskType } from '@/lib/data/crm/getTaskQueue'

export default function NewTaskDialog({
  taskTypes,
  createAction,
}: {
  taskTypes: CrmTaskType[]
  createAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [personId, setPersonId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('Follow Up')
  const [dueHours, setDueHours] = useState('24')

  const activeTypes = taskTypes.filter((t) => t.isActive)

  const submit = () => {
    setError(null)
    const fd = new FormData()
    fd.set('personId', personId.trim())
    fd.set('name', name.trim())
    fd.set('type', type)
    fd.set('dueHours', dueHours || '24')
    startTransition(async () => {
      const res = await createAction(fd)
      if (!res.ok) {
        setError(res.error ?? 'Could not create the task')
        return
      }
      setOpen(false)
      setPersonId('')
      setName('')
      setType('Follow Up')
      setDueHours('24')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-10 sm:h-9">
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-task-name">Task</Label>
            <Input
              id="new-task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Call back about the offer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-task-person">Contact id</Label>
            <Input
              id="new-task-person"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              inputMode="numeric"
              placeholder="The CRM contact id"
            />
            <p className="text-xs text-muted-foreground">A task is attached to a contact. Open the contact card to find the id.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-task-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="new-task-type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {activeTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-task-due">Due in (hours)</Label>
            <Input
              id="new-task-due"
              type="number"
              min="1"
              value={dueHours}
              onChange={(e) => setDueHours(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" disabled={pending || !name.trim() || !personId.trim()} onClick={submit}>
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
