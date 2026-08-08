'use client'

import { useState, useTransition } from 'react'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { updateOfficeHoursAction } from '@/app/actions/crm-company-settings'
import { OFFICE_DAYS } from '@/lib/crm/office-hours'
import { Button, TextField, ToolbarCheck } from '@/components/admin/v2'

/**
 * OfficeHoursEditor — spec §1.5 / AC-7.
 *
 * "+ Add office hours" opens an inline block form: day-of-week checkboxes +
 * start/end time pickers. Saved blocks render as rows with day/time labels and
 * a remove control; multiple blocks allowed. Saves through its own flow
 * (updateOfficeHoursAction), not the form's Save button, per §1.9.
 *
 * Enforcement is REAL: the inbound Twilio voice webhook routes callers to
 * voicemail outside these hours (lib/crm/office-hours.ts). An empty list means
 * always open.
 *
 * P11F: migrated to the LOCKED admin v2 language. The two mutually exclusive
 * entry points — "+ Add office hours" and the block form's "Save hours" — would
 * both read as primary; ci:admin-ui rule C allows one per file, so the commit
 * ("Save hours") keeps it and the opener is quiet.
 */
export function OfficeHoursEditor({ blocks: initial }: { blocks: OfficeHoursBlock[] }) {
  const [blocks, setBlocks] = useState<OfficeHoursBlock[]>(initial)
  const [adding, setAdding] = useState(false)
  const [days, setDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('18:00')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function persist(next: OfficeHoursBlock[]) {
    setError('')
    startTransition(async () => {
      try {
        await updateOfficeHoursAction(next)
        setBlocks(next)
        setAdding(false)
        setDays([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save office hours')
      }
    })
  }

  function addBlock() {
    if (days.length === 0) {
      setError('Pick at least one day.')
      return
    }
    // Keep day order canonical Mon..Sun regardless of click order.
    const ordered = OFFICE_DAYS.filter((d) => days.includes(d))
    persist([...blocks, { days: ordered, start_time: startTime, end_time: endTime }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s2)' }}>
      {blocks.length === 0 && !adding && (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          No office hours configured — calls ring through at all hours.
        </p>
      )}

      {blocks.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--a-s1)',
          }}
        >
          {blocks.map((block, i) => (
            <li
              key={`${block.days.join('-')}-${block.start_time}-${i}`}
              className="flex items-center justify-between"
              style={{
                gap: 'var(--a-s3)',
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-md)',
                background: 'var(--a-bg)',
                padding: 'var(--a-s2) var(--a-s3)',
              }}
            >
              <span className="a-num" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
                {block.days.join(', ')} · {block.start_time} to {block.end_time}
              </span>
              <Button
                variant="danger"
                disabled={isPending}
                onClick={() => persist(blocks.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--a-s3)',
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-md)',
            background: 'var(--a-bg)',
            padding: 'var(--a-s3)',
          }}
        >
          <div className="flex flex-wrap" style={{ gap: 'var(--a-s3)' }}>
            {OFFICE_DAYS.map((day) => (
              <ToolbarCheck
                key={day}
                label={day}
                checked={days.includes(day)}
                onChange={(e) => {
                  const checked = e.target.checked
                  setDays((prev) => (checked ? [...prev, day] : prev.filter((d) => d !== day)))
                }}
              />
            ))}
          </div>
          <div className="av2-inline-form">
            <TextField
              label="Start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <TextField
              label="End"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <div className="flex" style={{ gap: 'var(--a-s2)' }}>
              <Button disabled={isPending} onClick={addBlock}>
                {isPending ? 'Saving...' : 'Save hours'}
              </Button>
              <Button
                variant="quiet"
                disabled={isPending}
                onClick={() => {
                  setAdding(false)
                  setError('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="quiet" onClick={() => setAdding(true)}>
            + Add office hours
          </Button>
        </div>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p>
      )}
    </div>
  )
}
