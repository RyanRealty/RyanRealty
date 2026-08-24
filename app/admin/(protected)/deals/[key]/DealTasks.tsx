'use client'

import { useTransition } from 'react'
import { Button, StateWord } from '@/components/admin/v2'
import { setTcTaskStatus } from '@/app/actions/tc-tasks'
import type { TcTaskRow } from '@/lib/data/tc/task-reads'

export function DealTasks({
  tasks,
  propertyKey,
}: {
  tasks: TcTaskRow[]
  propertyKey: string
}) {
  if (!tasks.length) return null
  return (
    <section aria-label="File tasks">
      <h2
        style={{
          margin: '16px 0 8px',
          fontSize: 'var(--a-text-sm)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--a-text-2)',
        }}
      >
        File tasks
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} propertyKey={propertyKey} />
        ))}
      </ul>
    </section>
  )
}

function TaskRow({ task, propertyKey }: { task: TcTaskRow; propertyKey: string }) {
  const [pending, start] = useTransition()
  const open = task.status === 'open'
  return (
    <li
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 2px',
        borderBottom: '1px solid var(--a-border)',
      }}
    >
      <span>
        <span style={{ display: 'block', fontSize: 'var(--a-text-sm)' }}>{task.title}</span>
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{task.due_date ?? 'No date'}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <StateWord state={open ? 'slow' : 'ok'}>{open ? 'Open' : 'Done'}</StateWord>
        {open ? (
          <Button
            variant="quiet"
            disabled={pending}
            onClick={() => {
              start(() => {
                void setTcTaskStatus(task.id, 'done', propertyKey)
              })
            }}
          >
            Mark done
          </Button>
        ) : (
          <Button
            variant="quiet"
            disabled={pending}
            onClick={() => {
              start(() => {
                void setTcTaskStatus(task.id, 'open', propertyKey)
              })
            }}
          >
            Reopen
          </Button>
        )}
      </span>
    </li>
  )
}
