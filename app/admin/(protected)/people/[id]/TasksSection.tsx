/**
 * TasksSection (P11B B2) — open tasks + appointments for the person, complete
 * + add through the SAME actions the legacy workspace used
 * (completeCrmTaskAction / addCrmTaskAction via the people wrappers).
 */
import { Button, SectionHead, SelectField, TextField } from '@/components/admin/v2'

function tsLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

export function TasksSection(props: {
  tasks: Array<{
    id: number
    name: string
    type: string | null
    due_at: string | null
    completed_at: string | null
    assigned_broker: string | null
  }>
  appointments: Array<{
    id: number
    title: string
    startAt: string
    typeName: string | null
    outcomeName: string | null
    location: string | null
  }>
  completeTask: (taskId: number, formData: FormData) => Promise<void>
  addTask: (formData: FormData) => Promise<void>
}) {
  const open = props.tasks.filter((t) => !t.completed_at)
  const now = Date.now()
  return (
    <section aria-label="Tasks and appointments">
      <SectionHead>Tasks &amp; appointments</SectionHead>
      <ul className="av2-quietlist">
        {open.map((t) => {
          const overdue = t.due_at ? new Date(t.due_at).getTime() < now : false
          return (
            <li key={`t-${t.id}`} className="av2-quiet" style={{ alignItems: 'center' }}>
              <span className="av2-quiet__name" style={{ minWidth: 180 }}>
                {t.name}
              </span>
              <span>
                {[t.type, t.assigned_broker].filter(Boolean).join(' · ')}
              </span>
              <span
                className="av2-quiet__fig"
                style={overdue ? { color: 'var(--a-danger)', fontWeight: 600 } : undefined}
              >
                {t.due_at ? `${overdue ? 'overdue · ' : 'due '}${tsLabel(t.due_at)}` : 'no due date'}
              </span>
              <form action={props.completeTask.bind(null, t.id)}>
                <Button
                  type="submit"
                  variant="quiet"
                  style={{ minHeight: 28, padding: '0 10px', fontSize: 'var(--a-text-xs)' }}
                >
                  Done
                </Button>
              </form>
            </li>
          )
        })}
        {props.appointments.map((a) => (
          <li key={`a-${a.id}`} className="av2-quiet">
            <span className="av2-quiet__name" style={{ minWidth: 180 }}>
              {a.title}
            </span>
            <span>
              {['Appointment', a.typeName, a.outcomeName, a.location].filter(Boolean).join(' · ')}
            </span>
            <span className="av2-quiet__fig">{tsLabel(a.startAt)}</span>
          </li>
        ))}
        {open.length === 0 && props.appointments.length === 0 ? (
          <li className="av2-quiet">
            <span style={{ color: 'var(--a-text-2)' }}>No open tasks or appointments.</span>
          </li>
        ) : null}
      </ul>
      <form action={props.addTask} className="av2-inline-form" style={{ maxWidth: 560 }}>
        <TextField label="New task" name="name" placeholder="Call about the listing" required />
        <SelectField label="Due" name="dueHours" defaultValue="24">
          <option value="4">Today</option>
          <option value="24">Tomorrow</option>
          <option value="72">3 days</option>
          <option value="168">1 week</option>
        </SelectField>
        <Button type="submit" variant="quiet">
          Add task
        </Button>
      </form>
    </section>
  )
}
