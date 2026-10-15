import { EntityTitle, StateWord } from '@/components/admin/v2'
import type { PersonLeadType } from '@/lib/crm/person-identity-edit'
import { PersonIdentityEditor } from '@/components/admin/crm/PersonIdentityEditor'
import { LeadMoreMenu } from './LeadMoreMenu'

function initials(name: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function LeadHeader(props: {
  personId: number
  name: string | null
  firstName: string
  lastName: string
  leadType: PersonLeadType
  updateIdentity: (formData: FormData) => Promise<void>
  stage: string
  assignedBroker: string | null
  source: string | null
  phone: string | null
  email: string | null
  tags: string[]
  /** Matt only: the More menu offers "Draft review ask" (never sends). */
  canDraftReviewAsk?: boolean
}) {
  const meta = [
    props.phone ? null : 'No phone',
    props.email ? null : 'No email',
    props.assignedBroker ? `Assigned: ${props.assignedBroker}` : 'Unassigned',
    props.source ? `Source: ${props.source}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <header
      className="av2-pane"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '16px 20px',
        borderRadius: 12,
        flexWrap: 'wrap',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--a-text)',
          color: 'var(--a-bg)',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 600,
          fontSize: 17,
          flex: 'none',
        }}
      >
        {initials(props.name)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <EntityTitle>{props.name ?? 'Unknown contact'}</EntityTitle>
          <StateWord state="accent">{props.stage}</StateWord>
          {props.tags.slice(0, 3).map((tag) => (
            <StateWord key={tag} state={tag.startsWith('compliance') ? 'down' : 'waiting'}>
              {tag}
            </StateWord>
          ))}
        </div>
        <PersonIdentityEditor
          firstName={props.firstName}
          lastName={props.lastName}
          leadType={props.leadType}
          layout="3"
          action={props.updateIdentity}
        />
        <div style={{ marginTop: 4, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', fontFamily: 'var(--a-font-mono)' }}>
          {props.phone ? (
            <a href={`tel:${props.phone}`} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
              {props.phone}
            </a>
          ) : null}
          {props.phone && props.email ? <span> · </span> : null}
          {props.email ? (
            <a href="#comms" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
              {props.email}
            </a>
          ) : null}
          {meta ? (
            <>
              {(props.phone || props.email) && meta ? ' · ' : null}
              {meta}
            </>
          ) : null}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {props.phone ? (
          <a href={`tel:${props.phone}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Call
          </a>
        ) : null}
        <LeadMoreMenu
          personId={props.personId}
          toolsHref={`/admin/people/${props.personId}/tools`}
          canDraftReviewAsk={props.canDraftReviewAsk === true}
        />
      </div>
    </header>
  )
}