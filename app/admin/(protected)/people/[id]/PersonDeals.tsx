import Link from 'next/link'
import type { PersonWhoLabel } from '@/lib/crm/person-who-labels'
import type { PersonDealLink } from '@/lib/data/tc/deal-people'
import {
  DEAL_PERSON_ROLE_LABEL,
  defaultDealAddress,
  defaultDealRoleFromWho,
  relatedPartiesForStartDeal,
} from '@/lib/tc/deal-people'
import { StartDealForm } from './StartDealForm'

const STAGE_WORD: Record<string, string> = {
  pending: 'Under contract',
  active_listing: 'Active listing',
  pre_contract: 'Pre-contract',
  closed: 'Closed',
  dead: 'Canceled',
}

export function PersonDeals({
  personId,
  deals,
  prospectStory,
  inboundAddress,
  whoLabels,
  relationships,
}: {
  personId: number
  deals: PersonDealLink[]
  prospectStory: ReadonlyArray<{ streetAddress: string | null; city: string | null }>
  inboundAddress: string | null
  whoLabels: readonly PersonWhoLabel[]
  relationships: ReadonlyArray<{
    relatedPersonId: number | null
    name: string
    label: string
    type: string
  }>
}) {
  const defaultRole = defaultDealRoleFromWho(whoLabels)
  return (
    <>
      {deals.length > 0 ? (
        <section aria-label="Deals">
          <h2 className="av2-lane-head">Deals</h2>
          <ul className="av2-quietlist">
            {deals.map((d) => (
              <li key={d.dealId} className="av2-quiet">
                <Link
                  href={`/admin/deals/${encodeURIComponent(d.propertyKey)}`}
                  className="av2-quiet__name"
                  style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}
                >
                  {d.address}
                </Link>
                <span style={{ color: 'var(--a-text-2)' }}>
                  {DEAL_PERSON_ROLE_LABEL[d.role]} · {STAGE_WORD[d.stage] ?? d.stage}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <StartDealForm
        personId={personId}
        defaultAddress={defaultDealAddress(prospectStory, inboundAddress)}
        defaultRole={defaultRole}
        related={relatedPartiesForStartDeal(relationships, personId, defaultRole)}
      />
    </>
  )
}
