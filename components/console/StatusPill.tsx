/**
 * StatusPill — the console's single status primitive. Color is always a SIGNAL,
 * never decoration, and never on its own: every pill is a colored dot + a soft
 * tinted fill + a text label (Carbon/WCAG: status is never color alone). Tones
 * are driven by the --console-* tokens so they stay neutral-friendly and adapt
 * to dark mode.
 */

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<Tone, { soft: string; strong: string; dot: string }> = {
  neutral: { soft: 'var(--console-neutral-soft)', strong: 'var(--console-neutral-strong)', dot: 'var(--console-neutral)' },
  info: { soft: 'var(--console-info-soft)', strong: 'var(--console-info-strong)', dot: 'var(--console-info)' },
  success: { soft: 'var(--console-success-soft)', strong: 'var(--console-success-strong)', dot: 'var(--console-success)' },
  warning: { soft: 'var(--console-warning-soft)', strong: 'var(--console-warning-strong)', dot: 'var(--console-warning)' },
  danger: { soft: 'var(--console-danger-soft)', strong: 'var(--console-danger-strong)', dot: 'var(--console-danger)' },
}

export function StatusPill({ tone, label, pulse = false }: { tone: Tone; label: string; pulse?: boolean }) {
  const t = TONE[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: t.soft, color: t.strong }}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: t.dot }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: t.dot }} />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot }} />
      )}
      {label}
    </span>
  )
}

/** Map a real CRM stage (lib/crm/constants CRM_STAGES) to a signal tone. Heat =
 *  danger, warm = warning, active deal = success/info, dormant = neutral. */
export function stageTone(stage: string): Tone {
  const s = stage.toLowerCase()
  if (s.includes('hot')) return 'danger'
  if (s.includes('warm')) return 'warning'
  if (s.includes('pending')) return 'info'
  if (s.includes('active client')) return 'success'
  if (s.includes('seller prospect') || s === 'lead' || s.includes('renter')) return 'info'
  if (s.includes('cold') || s.includes('nurture') || s.includes('sphere') || s.includes('past client')) return 'neutral'
  return 'neutral'
}

export function StagePill({ stage }: { stage: string }) {
  return <StatusPill tone={stageTone(stage)} label={stage} />
}

/** MLS standard_status → tone. Active/Coming Soon read as live (success); under
 *  contract/pending as caution (warning); off-market as neutral/danger. */
export function listingStatusTone(status: string | null | undefined): Tone {
  const s = (status ?? '').toLowerCase()
  if (s.includes('coming')) return 'info'
  if (s.includes('active under contract') || s.includes('pending')) return 'warning'
  if (s.includes('active')) return 'success'
  if (s.includes('closed') || s.includes('sold')) return 'neutral'
  if (s.includes('withdraw') || s.includes('cancel') || s.includes('expired')) return 'danger'
  return 'neutral'
}

export function ListingStatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return null
  return <StatusPill tone={listingStatusTone(status)} label={status} />
}
