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
 * 11F: migrated to the admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export name, signature and return type is
 * unchanged, and brokerBadgeColor still returns a CSS colour string its
 * callers drop straight into a style prop.
 *
 * Two colour decisions, both forced by the canon:
 *  - the glyph tones move to var(--a-*): ok/warn/danger/accent stay STATUS
 *    semantics (ADMIN_UI §1), which is what the shadcn success/warning/
 *    destructive classes were standing in for.
 *  - the §29 per-broker badge palette survives, re-expressed in admin tokens.
 *    Its matt entry WAS the public brand navy, which the admin blacklists as
 *    design input; the replacement is derived from the admin accent instead.
 *    See brokerBadgeColor for why each entry is mixed toward black.
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
import '@/components/admin/v2/admin-v2.css'

/** §29 A.6 — type-coded glyph. `size` in px (20 on calendar rows, 14 on task rows). */
export function MobileTypeIcon({ type, size = 20, className }: { type: string | null; size?: number; className?: string }) {
  const cls = cn('shrink-0', className)
  // lucide strokes with currentColor, so the tone rides in on `color`.
  const style = (color: string) => ({ width: size, height: size, color })
  switch (type) {
    case 'Call': return <Phone style={style('var(--a-ok)')} className={cls} aria-hidden />
    case 'Follow Up': return <Flag style={style('var(--a-text-2)')} className={cls} aria-hidden />
    case 'Email': return <Mail style={style('var(--a-accent)')} className={cls} aria-hidden />
    case 'Text': return <MessageSquare style={style('var(--a-accent)')} className={cls} aria-hidden />
    case 'Showing': return <Home style={style('var(--a-warn)')} className={cls} aria-hidden />
    case 'Closing': return <Check style={style('var(--a-ok)')} className={cls} aria-hidden />
    case 'Open House': return <DoorOpen style={style('var(--a-text-2)')} className={cls} aria-hidden />
    case 'Thank You': return <Heart style={style('var(--a-danger)')} className={cls} aria-hidden />
    case 'Appointment': return <Calendar style={style('var(--a-accent)')} className={cls} aria-hidden />
    default: return <ClipboardList style={style('var(--a-text-2)')} className={cls} aria-hidden />
  }
}

/** §29 broker initials badge — the deterministic per-slug palette, restored in
 *  admin tokens (matt navy → accent-strong, paul indigo → accent, rebecca
 *  teal-green → ok; unknown slugs fall back to paul's, per spec).
 *
 *  Every entry is mixed 45% toward black on purpose. The contract this function
 *  has always had is ALWAYS A DARK FILL: its caller
 *  (components/admin/crm/calendar/mobile/MobileCalendarRows.tsx) paints white
 *  initials on whatever comes back. A bare token cannot honour that — every
 *  admin colour token flips lightness under [data-theme="dark"], so a fill
 *  chosen for white text in light mode inverts to a pale tint in dark and the
 *  initials vanish.
 *
 *  The token-native answer is to let BOTH sides flip together: these fills pair
 *  with var(--a-btn-fg), which is #FFFFFF in light and #0B0B0C in dark, exactly
 *  as every solid button in the language already does. The caller
 *  (components/admin/crm/calendar/mobile/MobileCalendarRows.tsx) sets that
 *  instead of a hardcoded text-white. Shipped ratios with --a-btn-fg: matt
 *  12.62:1, paul 4.77:1, rebecca 4.72:1 in light, and all three high in dark.
 *
 *  An earlier fix reached for color-mix(... 45%, black) to force a
 *  always-dark fill. That is banned by rule 2 of ci:admin-v2-tokens (no colour
 *  function literals — colour reaches components only through var(--a-*)), and
 *  it was solving a problem the paired foreground does not have. */
const BROKER_BADGE_COLORS: Record<string, string> = {
  matt: 'var(--a-accent-strong)',
  paul: 'var(--a-accent)',
  rebecca: 'var(--a-ok)',
}

export function brokerBadgeColor(slug: string | null | undefined): string {
  return (slug && BROKER_BADGE_COLORS[slug]) || 'var(--a-accent)'
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
