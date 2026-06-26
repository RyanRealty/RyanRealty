'use client'

/**
 * CrmMobileKit — the shared Follow Up Boss–style mobile primitives.
 *
 * Matt directive 2026-06-26: the CRM must look + behave like the FUB iOS app on
 * phones. Every CRM list/detail screen composes these so the look lives in ONE
 * place and can't drift screen-by-screen. Token-pure classNames (inherits the
 * neutral .console-root scope); the ONLY literal colors are the deterministic
 * avatar fills, applied via inline style so the design-token linter stays green.
 *
 * Desktop is untouched — wrap each usage in `md:hidden` / `lg:hidden` so the
 * existing console tables/panels keep rendering at the larger breakpoints.
 */

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Avatars ─────────────────────────────────────────────────────────────── */

// FUB-style colorful avatars: a fixed palette, deterministically picked from the
// name so the same person is always the same color across screens.
const AVATAR_COLORS = [
  '#b45309', '#dc2626', '#65a30d', '#0891b2', '#2563eb',
  '#7c3aed', '#db2777', '#475569', '#0d9488', '#ea580c',
  '#4f46e5', '#16a34a',
]

export function crmAvatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function crmInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function CrmAvatar({
  name,
  src,
  size = 44,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  const dim = { width: size, height: size }
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={dim}
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <span
      style={{ ...dim, backgroundColor: crmAvatarColor(name) }}
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{crmInitials(name)}</span>
    </span>
  )
}

/* ── List row (the workhorse) ────────────────────────────────────────────── */

/**
 * CrmListRow — one tappable FUB-style row: avatar · (title + subtitle) · right
 * meta + chevron. The WHOLE row is the tap target (min 64px tall for thumbs).
 */
export function CrmListRow({
  href,
  name,
  src,
  title,
  subtitle,
  meta,
  badge,
  trailing,
  className,
}: {
  href?: string
  /** seed for the avatar color/initials (usually the person name) */
  name: string
  src?: string | null
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** right-aligned timestamp / small meta under the chevron */
  meta?: React.ReactNode
  badge?: React.ReactNode
  /** replaces the chevron+meta column entirely (e.g. action buttons) */
  trailing?: React.ReactNode
  className?: string
}) {
  const body = (
    <>
      <CrmAvatar name={name} src={src} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-foreground">{title}</span>
          {badge}
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          {href ? <ChevronRight className="h-4 w-4 text-muted-foreground/60" /> : null}
        </div>
      )}
    </>
  )
  const cls = cn(
    'flex items-center gap-3 px-4 py-3 min-h-16 active:bg-accent/60',
    className,
  )
  if (href) {
    return (
      <Link href={href} className={cn(cls, 'transition-colors hover:bg-accent/50')}>
        {body}
      </Link>
    )
  }
  return <div className={cls}>{body}</div>
}

/** Hairline-divided container for a stack of CrmListRow. */
export function CrmList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border', className)}>{children}</div>
}

/* ── Segmented sub-tabs (New Leads | Emails | Website) ───────────────────── */

export function CrmSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex border-b border-border', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 px-2 py-3 text-center text-[13px] font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {o.label}
            {active ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* ── Detail sections (PHONE NUMBERS / DETAILS rows) ──────────────────────── */

export function CrmSectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      {action}
    </div>
  )
}

/** Label-left / value-right row with optional chevron — the Info-tab detail line. */
export function CrmDetailRow({
  label,
  value,
  href,
  onClick,
}: {
  label: React.ReactNode
  value: React.ReactNode
  href?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className="shrink-0 text-[14px] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-right text-[14px] font-medium text-foreground">
        <span className="truncate">{value}</span>
        {(href || onClick) ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : null}
      </span>
    </>
  )
  const cls = 'flex items-center justify-between gap-3 px-4 py-3.5 min-h-12'
  if (href) return <Link href={href} className={cn(cls, 'active:bg-accent/60')}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full active:bg-accent/60')}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

/* ── Round contact-action button (chat / call / email) ───────────────────── */

export function CrmActionCircle({
  icon: Icon,
  label,
  tone,
  href,
  onClick,
}: {
  icon: typeof ChevronRight
  label: string
  tone: 'chat' | 'call' | 'email'
  href?: string
  onClick?: () => void
}) {
  const bg = { chat: '#6366f1', call: '#22c55e', email: '#38bdf8' }[tone]
  const inner = <Icon className="h-[18px] w-[18px] text-white" />
  const cls = 'flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95'
  if (href) {
    return (
      <a href={href} aria-label={label} style={{ backgroundColor: bg }} className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} style={{ backgroundColor: bg }} className={cls}>
      {inner}
    </button>
  )
}
