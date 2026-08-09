'use client'

/**
 * task-type-icons — the §29 A.6 activity-type → icon map + the deterministic
 * per-broker badge palette, shared by the mobile Calendar (§29 Screen A) and
 * mobile Tasks (§29 Screen C) surfaces.
 *
 * Task types are stored as DISPLAY strings on crm_tasks.type ('Call',
 * 'Follow Up', …) — the map keys match the crm_task_types labels the desktop
 * §1.12 TypeIcon uses, re-sized for the 20pt mobile row glyph.
 *
 * Broker badge colors are the §29 "Broker initials color palette": matt navy,
 * paul indigo (FUB-observed), rebecca teal-green; unknown slugs fall back to
 * indigo per spec.
 */

import {
  Calendar,
  Check,
  ClipboardList,
  DoorOpen,
  Flag,
  Heart,
  Home,
  Mail,
  MessageSquare,
  Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CRM_BROKER_DISPLAY } from '@/lib/crm/constants'

/** §29 A.6 — type-coded glyph. `size` in px (20 on calendar rows, 14 on task rows). */
export function MobileTypeIcon({ type, size = 20, className }: { type: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size }
  const cls = (color: string) => cn('shrink-0', color, className)
  switch (type) {
    case 'Call': return <Phone style={style} className={cls('text-success')} aria-hidden />
    case 'Follow Up': return <Flag style={style} className={cls('text-muted-foreground')} aria-hidden />
    case 'Email': return <Mail style={style} className={cls('text-primary')} aria-hidden />
    case 'Text': return <MessageSquare style={style} className={cls('text-primary')} aria-hidden />
    case 'Showing': return <Home style={style} className={cls('text-warning')} aria-hidden />
    case 'Closing': return <Check style={style} className={cls('text-success')} aria-hidden />
    case 'Open House': return <DoorOpen style={style} className={cls('text-muted-foreground')} aria-hidden />
    case 'Thank You': return <Heart style={style} className={cls('text-destructive')} aria-hidden />
    case 'Appointment': return <Calendar style={style} className={cls('text-primary')} aria-hidden />
    default: return <ClipboardList style={style} className={cls('text-muted-foreground')} aria-hidden />
  }
}

/** §29 broker initials palette — deterministic per user, fallback indigo. */
const BROKER_BADGE_COLORS: Record<string, string> = {
  matt: '#102742',
  paul: '#5C6BBF',
  rebecca: '#2AB57D',
}

export function brokerBadgeColor(slug: string | null | undefined): string {
  return (slug && BROKER_BADGE_COLORS[slug]) || '#5C6BBF'
}

export function brokerInitialsFor(slug: string | null | undefined): string {
  const name = slug ? (CRM_BROKER_DISPLAY as Record<string, string>)[slug] ?? slug : ''
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

export function brokerDisplayName(slug: string | null | undefined): string | null {
  return slug ? (CRM_BROKER_DISPLAY as Record<string, string>)[slug] ?? slug : null
}

/** §25.8.3 / §29 header avatar — the real broker headshots. */
export const BROKER_HEADSHOTS: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}
