'use client'

/**
 * mobile-tasks-bits — stateless helpers + the type-coded glyph for
 * MobileTasksScreen, extracted in 11F so that file stays under the 600-LOC
 * budget (ci:file-size-budget). Splitting the file is the fix the gate asks
 * for; re-baselining a ~615-line component is not.
 */
import {
  Calendar, Check, ClipboardList, DoorOpen, Flag, Heart, Home, Mail, MessageSquare, Phone,
} from 'lucide-react'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'

export type MobileTasksView = 'today' | 'overdue' | 'upcoming'

export const ACTION_W = 88

export const TAB_LABELS: Record<MobileTasksView, string> = {
  today: "Today's Tasks",
  overdue: 'Overdue',
  upcoming: 'Future',
}
export const HEADER_TITLES: Record<MobileTasksView, string> = {
  today: "Today's Tasks",
  overdue: 'Overdue Tasks',
  upcoming: 'Future Tasks',
}

export function tabHref(view: MobileTasksView, agent: string, showCompleted: boolean): string {
  const p = new URLSearchParams()
  p.set('view', view === 'upcoming' ? 'future' : view)
  if (agent !== 'me') p.set('agent', agent)
  if (showCompleted) p.set('completed', '1')
  return `/admin/crm/tasks?${p.toString()}`
}

/** Inlined from task-type-icons.tsx's brokerDisplayName (admin v2 amnesia). */
export function brokerName(slug: string | null | undefined): string | null {
  return slug ? (CRM_BROKER_DISPLAY as Record<string, string>)[slug] ?? slug : null
}

/** §29 A.6 — type-coded glyph, inlined from task-type-icons.tsx on admin v2 tokens. */
export function TaskTypeGlyph({ type, size = 20 }: { type: string | null; size?: number }) {
  const style = { width: size, height: size, flexShrink: 0 } as const
  switch (type) {
    case 'Call': return <Phone style={{ ...style, color: 'var(--a-ok)' }} aria-hidden />
    case 'Follow Up': return <Flag style={{ ...style, color: 'var(--a-text-2)' }} aria-hidden />
    case 'Email': return <Mail style={{ ...style, color: 'var(--a-accent)' }} aria-hidden />
    case 'Text': return <MessageSquare style={{ ...style, color: 'var(--a-accent)' }} aria-hidden />
    case 'Showing': return <Home style={{ ...style, color: 'var(--a-warn)' }} aria-hidden />
    case 'Closing': return <Check style={{ ...style, color: 'var(--a-ok)' }} aria-hidden />
    case 'Open House': return <DoorOpen style={{ ...style, color: 'var(--a-text-2)' }} aria-hidden />
    case 'Thank You': return <Heart style={{ ...style, color: 'var(--a-danger)' }} aria-hidden />
    case 'Appointment': return <Calendar style={{ ...style, color: 'var(--a-accent)' }} aria-hidden />
    default: return <ClipboardList style={{ ...style, color: 'var(--a-text-2)' }} aria-hidden />
  }
}
