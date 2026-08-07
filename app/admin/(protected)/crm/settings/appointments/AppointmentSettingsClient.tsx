'use client'

/**
 * AppointmentSettingsClient (11C, v2 language migration) — appointment types +
 * outcome labels. Same server actions (create/update/delete for both lookups),
 * same optimistic-free router.refresh() after each mutation, same
 * confirm-before-delete step; the confirm now renders inline instead of in a
 * modal because the v2 language has no dialog primitive.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SectionHead, StateWord, TextField } from '@/components/admin/v2'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <LookupSection
        title="Appointment types"
        noun="type"
        description="The types available in the appointment form (Buyer consultation, Listing consultation, etc.)."
        items={types}
        onCreate={async (name) => { await createAppointmentTypeAction(name); router.refresh() }}
        onToggle={async (id, active) => { await updateAppointmentTypeAction(id, { active }); router.refresh() }}
        onDelete={async (id) => { await deleteAppointmentTypeAction(id); router.refresh() }}
      />
      <LookupSection
        title="Appointment outcomes"
        noun="outcome"
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
  noun,
  description,
  items,
  onCreate,
  onToggle,
  onDelete,
}: {
  title: string
  noun: string
  description: string
  items: Array<{ id: number; name: string; active: boolean }>
  onCreate: (name: string) => Promise<void>
  onToggle: (id: number, active: boolean) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Confirm-before-delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    startTransition(() => onDelete(id))
  }

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
    <section aria-label={title}>
      <SectionHead>{title}</SectionHead>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{description}</p>

      <ul className="av2-quietlist">
        {items.length === 0 ? (
          <li className="av2-quiet">
            <span style={{ color: 'var(--a-text-2)' }}>No items yet.</span>
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="av2-quiet">
              <span
                style={{
                  color: item.active ? 'var(--a-text)' : 'var(--a-text-2)',
                  fontWeight: item.active ? 500 : 400,
                  textDecoration: item.active ? 'none' : 'line-through',
                  minWidth: 130,
                }}
              >
                {item.name}
              </span>
              <StateWord state={item.active ? 'ok' : 'waiting'}>{item.active ? 'On' : 'Off'}</StateWord>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="quiet"
                  aria-pressed={item.active}
                  aria-label={`Toggle ${item.name}`}
                  disabled={pending}
                  onClick={() => startTransition(() => onToggle(item.id, !item.active))}
                >
                  {item.active ? 'Turn off' : 'Turn on'}
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  aria-label={`Delete ${item.name}`}
                  disabled={pending}
                  onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                >
                  Delete
                </Button>
              </span>
            </li>
          ))
        )}
      </ul>

      {deleteTarget ? (
        <div
          role="alertdialog"
          aria-label={`Delete ${deleteTarget.name}`}
          className="av2-pane"
          style={{ marginBottom: 12 }}
        >
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
            <b>Delete &ldquo;{deleteTarget.name}&rdquo;?</b> This removes the item permanently. Any appointments
            already logged with this {noun} keep their existing value, but the option will no longer appear in the
            picker.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="quiet" onClick={() => setDeleteTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete} disabled={pending}>
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      <div className="av2-inline-form">
        <TextField
          label={`Add a ${noun}`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New item name"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          error={error ?? undefined}
        />
        <div>
          <Button type="button" disabled={pending || !newName.trim()} onClick={handleAdd}>
            Add
          </Button>
        </div>
      </div>
    </section>
  )
}
