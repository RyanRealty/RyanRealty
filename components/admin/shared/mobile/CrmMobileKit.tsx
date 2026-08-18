'use client'

/**
 * CrmMobileKit — shared mobile CRM primitives.
 *
 * Matt directive 2026-06-26: the CRM must look + behave like the FUB iOS app on
 * phones. Every CRM list/detail screen composes these so the look lives in ONE
 * place and can't drift screen-by-screen.
 *
 * 11F: migrated to the admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop and handler is unchanged. Colour now
 * comes from var(--a-*) instead of the shadcn semantic classes, which resolve
 * to the PUBLIC brand palette the admin blacklists (§5 amnesia). One canon
 * consequence, precedent (thread-bits.tsx ThreadAvatar, DealsBoard): the
 * per-person avatar hue is gone. ADMIN_UI §1 reserves colour for action/status,
 * so identity reads by initials on a neutral fill. crmAvatarColor is still
 * re-exported (callers import it from here) — it is simply no longer this kit's
 * own design input. CrmActionCircle keeps three distinct tones: those ARE
 * actions, which is what §1 reserves colour for.
 *
 * Desktop is untouched — wrap each usage in `md:hidden` / `lg:hidden` so the
 * existing console tables/panels keep rendering at the larger breakpoints.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { crmAvatarColor, crmInitials } from '@/lib/admin/crm-avatar'
import '@/components/admin/v2/admin-v2.css'

/* ── Avatars ─────────────────────────────────────────────────────────────── */

// Pure color/initials helpers live in avatar-utils (non-client) so server
// components can use them too; re-exported here for existing client callers.
export { crmAvatarColor, crmInitials }

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
  // A rotted photo URL must fall back to initials. Radix <Avatar> rendered its
  // fallback whenever the image was not 'loaded' — including a 404 — so a stale
  // FUB/Gravatar/social URL still showed initials. A bare <img> shows the
  // browser's broken-image glyph instead, and this component is now the avatar
  // on the person workspace and the people table.
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={dim}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        // object-top: portrait sources (2:3 broker headshots) center-crop to
        // the torso without it. No effect on square/landscape photos.
        className={cn('shrink-0 rounded-full object-cover object-top', className)}
      />
    )
  }
  return (
    <span
      style={{ ...dim, background: 'var(--a-inset)', color: 'var(--a-text)' }}
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', className)}
    >
      {/* Floored at the smallest type token: at size 20 the 0.36 ratio computes
          to 7px, under --a-text-xs (11px). */}
      <span style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}>{crmInitials(name)}</span>
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
          <span className="truncate text-[15px] font-semibold" style={{ color: 'var(--a-text)' }}>{title}</span>
          {badge}
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--a-text-2)' }}>{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {meta ? <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>{meta}</span> : null}
          {href ? <ChevronRight className="h-4 w-4 opacity-60" style={{ color: 'var(--a-text-2)' }} /> : null}
        </div>
      )}
    </>
  )
  // The pressed/hover tint was a shadcn `accent` wash. A pseudo-class cannot
  // live in an inline style and admin-v2.css is not this unit's file, so the
  // feedback rides on the opacity dip the kit already uses on its buttons —
  // BOTH states, the way the source had both: active on every row, hover on
  // the linked row only.
  const cls = cn(
    'flex items-center gap-3 px-4 py-3 min-h-16 active:opacity-70',
    className,
  )
  if (href) {
    return (
      <Link href={href} className={cn(cls, 'transition-opacity hover:opacity-80')}>
        {body}
      </Link>
    )
  }
  return <div className={cls}>{body}</div>
}

/** Hairline-divided container for a stack of CrmListRow. */
export function CrmList({ children, className }: { children: React.ReactNode; className?: string }) {
  // divide-* paints the CHILDREN's border, which an inline style on this
  // wrapper cannot reach — so the token rides in as the divide colour itself.
  return <div className={cn('divide-y divide-[color:var(--a-border)]', className)}>{children}</div>
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
    <div className={cn('flex border-b', className)} style={{ borderColor: 'var(--a-border)' }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="relative flex-1 px-2 py-3 text-center text-[13px] font-medium transition-colors"
            style={{ color: active ? 'var(--a-text)' : 'var(--a-text-2)' }}
          >
            {o.label}
            {active ? (
              <span
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                style={{ background: 'var(--a-accent)' }}
              />
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
    <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--a-surface)' }}>
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--a-text-2)' }}>{children}</span>
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
      <span className="shrink-0 text-[14px]" style={{ color: 'var(--a-text-2)' }}>{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-right text-[14px] font-medium" style={{ color: 'var(--a-text)' }}>
        <span className="truncate">{value}</span>
        {(href || onClick) ? <ChevronRight className="h-4 w-4 shrink-0 opacity-60" style={{ color: 'var(--a-text-2)' }} /> : null}
      </span>
    </>
  )
  const cls = 'flex items-center justify-between gap-3 px-4 py-3.5 min-h-12'
  if (href) return <Link href={href} className={cn(cls, 'active:opacity-70')}>{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full active:opacity-70')}>{inner}</button>
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
  // `tone` discriminates the fill, as it did before the migration (chat
  // indigo / call green / email sky). Collapsing all three onto one solid left
  // the prop inert — a required discriminator that could not reach the render.
  // Each of these three carries --a-btn-fg at AA in BOTH themes: light
  // 12.62 / 4.72 / 4.77 against white, dark 15.04 / 10.49 / 6.03 against the
  // dark foreground the dark scale flips solids to (ADMIN_UI §4).
  const bg = { chat: 'var(--a-accent-strong)', call: 'var(--a-ok)', email: 'var(--a-btn-bg)' }[tone]
  // lucide strokes with currentColor, so the button's own colour dresses it.
  const inner = <Icon className="h-[18px] w-[18px]" />
  const style = { backgroundColor: bg, color: 'var(--a-btn-fg)' }
  const cls = 'flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95'
  if (href) {
    return (
      <a href={href} aria-label={label} style={style} className={cls}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} style={style} className={cls}>
      {inner}
    </button>
  )
}
