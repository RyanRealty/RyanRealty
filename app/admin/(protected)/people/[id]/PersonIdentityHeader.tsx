import { EntityTitle, StateWord } from '@/components/admin/v2'
import type { PersonWhoLabel } from '@/lib/crm/person-who-labels'

type PersonIdentityHeaderProps = {
  name: string | null
  whoLabels: PersonWhoLabel[]
  stage: string
  assignedBroker: string | null
  nextLine?: string | null
  nowLine?: string | null
  phone: string | null
  email: string | null
  addressLine?: string | null
  source: string | null
  price: number | null
  timeframe: string | null
  tags: string[]
}

export function PersonIdentityHeader({
  name,
  whoLabels,
  stage,
  assignedBroker,
  nextLine,
  nowLine,
  phone,
  email,
  addressLine,
  source,
  price,
  timeframe,
  tags,
}: PersonIdentityHeaderProps) {
  const meta = [
    source ? `source ${source}` : null,
    price != null ? `budget $${Math.round(price).toLocaleString('en-US')}` : null,
    timeframe ?? null,
    tags.length > 0 ? tags.slice(0, 4).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <EntityTitle>{name ?? 'Unknown contact'}</EntityTitle>
        {whoLabels.map((label) => (
          <StateWord key={label} state="waiting">
            {label}
          </StateWord>
        ))}
        <StateWord state="accent">{stage}</StateWord>
        {assignedBroker ? (
          <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>assigned {assignedBroker}</span>
        ) : null}
      </div>
      {nextLine || nowLine ? (
        <div style={{ margin: '8px 0 4px', fontSize: 'var(--a-text-sm)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nextLine ? (
            <div>
              <span style={{ color: 'var(--a-text-2)' }}>Next </span>
              {nextLine}
            </div>
          ) : null}
          {nowLine ? (
            <div>
              <span style={{ color: 'var(--a-text-2)' }}>Now </span>
              {nowLine}
            </div>
          ) : null}
        </div>
      ) : null}
      <div style={{ margin: '4px 0 4px', fontSize: 'var(--a-text-sm)', fontFamily: 'var(--a-font-mono)' }}>
        {phone ? (
          <a href={`tel:${phone}`} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
            {phone}
          </a>
        ) : null}
        {phone && email ? <span style={{ color: 'var(--a-text-2)' }}> · </span> : null}
        {email ? <span>{email}</span> : null}
        {!phone && !email ? <span style={{ color: 'var(--a-text-2)' }}>No contact points</span> : null}
      </div>
      {addressLine ? (
        <div style={{ margin: '0 0 4px', fontSize: 'var(--a-text-sm)', fontFamily: 'var(--a-font-mono)' }}>
          {addressLine}
        </div>
      ) : null}
      <div style={{ margin: '0 0 14px', color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>
        {meta || '—'}
      </div>
    </>
  )
}
