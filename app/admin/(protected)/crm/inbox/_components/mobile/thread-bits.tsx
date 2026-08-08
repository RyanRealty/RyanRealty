'use client'

/**
 * Small presentational helpers for the phone thread — extracted from
 * MobileThread in 11F so that file stays under the 600-LOC budget
 * (ci:file-size-budget). Splitting the file is the fix the gate asks for;
 * re-baselining a 787-line component is not.
 *
 * These exist because the v2 barrel deliberately has no Alert or Avatar
 * primitive, and avatar-utils.ts lives under legacy components/admin/*, which
 * the token gate blacklists as design input.
 */

export function mmss(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/** (NNN) NNN-NNNN display for the Block row + call sheet (AC-26G-04). */
export function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw
}

/** Deterministic initials from a display name — mirrors crmInitials, inlined
 *  because avatar-utils.ts lives under legacy components/admin/* (blacklisted
 *  as design input for admin v2, ci:admin-ui LEGACY_IMPORT). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Initials avatar on a neutral token fill. Admin v2 reserves color for
 *  action/status (ADMIN_UI §1); per-person hue coding (the old FUB-style
 *  palette) is out of canon here, so identity reads by initials, not color. */
export function ThreadAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        background: 'var(--a-inset)',
        color: 'var(--a-text)',
        fontSize: Math.round(size * 0.36),
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {initials(name)}
    </span>
  )
}

/** Inline error banner — replaces shadcn Alert/AlertDescription (banned
 *  import). Same role="alert" semantics as the component it replaces. */
export function ErrorNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={className}
      style={{
        border: '1px solid var(--a-danger)',
        background: 'var(--a-danger-wash)',
        color: 'var(--a-danger)',
        borderRadius: 'var(--a-r-md)',
        padding: 'var(--a-s3)',
        fontSize: 'var(--a-text-sm)',
      }}
    >
      {children}
    </div>
  )
}
