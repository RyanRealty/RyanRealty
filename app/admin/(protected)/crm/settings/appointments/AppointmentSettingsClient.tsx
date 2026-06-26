'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import {
  createAppointmentTypeAction,
  updateAppointmentTypeAction,
  deleteAppointmentTypeAction,
  createAppointmentOutcomeAction,
  updateAppointmentOutcomeAction,
  deleteAppointmentOutcomeAction,
} from '@/app/actions/appointments'
import type { AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'

export default function AppointmentSettingsClient({
  types,
  outcomes,
}: {
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
}) {
  const router = useRouter()

  return (
    <div className="space-y-8">
      <LookupSection
        title="Appointment types"
        description="The types available in the appointment form (Buyer consultation, Listing consultation, etc.)."
        items={types}
        onCreate={async (name) => { await createAppointmentTypeAction(name); router.refresh() }}
        onToggle={async (id, active) => { await updateAppointmentTypeAction(id, { active }); router.refresh() }}
        onDelete={async (id) => { await deleteAppointmentTypeAction(id); router.refresh() }}
      />
      <LookupSection
        title="Appointment outcomes"
        description="The outcome labels set after an appointment completes (No show, Listing obtained, etc.)."
        items={outcomes}
        onCreate={async (name) => { await createAppointmentOutcomeAction(name); router.refresh() }}
        onToggle={async (id, active) => { await updateAppointmentOutcomeAction(id, { active }); router.refresh() }}
        onDelete={async (id) => { await deleteAppointmentOutcomeAction(id); router.refresh() }}
      />
    </div>
  )
}

function LookupSection({
  title,
  description,
  items,
  onCreate,
  onToggle,
  onDelete,
}: {
  title: string
  description: string
  items: Array<{ id: number; name: string; active: boolean }>
  onCreate: (name: string) => Promise<void>
  onToggle: (id: number, active: boolean) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    if (!newName.trim()) return
    setError(null)
    startTransition(async () => {
      try {
        await onCreate(newName.trim())
        setNewName('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not add item')
      }
    })
  }

  return (
    <ConsoleSection title={title}>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>

      <div className="divide-y divide-border rounded-lg border border-border">
        {items.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No items yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span
                className={
                  item.active
                    ? 'text-sm font-medium text-foreground'
                    : 'text-sm text-muted-foreground line-through'
                }
              >
                {item.name}
              </span>
              <div className="flex items-center gap-3">
                <Switch
                  checked={item.active}
                  onCheckedChange={(v) => startTransition(() => onToggle(item.id, v))}
                  aria-label={`Toggle ${item.name}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => startTransition(() => onDelete(item.id))}
                  className="h-auto px-2 py-0.5 text-xs text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${item.name}`}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New item name"
          className="h-9"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0"
          disabled={pending || !newName.trim()}
          onClick={handleAdd}
        >
          Add
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </ConsoleSection>
  )
}
