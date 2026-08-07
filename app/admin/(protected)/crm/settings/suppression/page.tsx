// @no-parity — internal admin surface, no public mockup contract
// P11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// The page scaffolding, lead verdict, and doors are v2; the interactive
// suppression island (components/admin/crm/settings/SuppressionAdmin) is a
// sanctioned legacy chokepoint that still owns the add/lift server actions
// verbatim — behavior is unchanged by this migration.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getCrmSuppressions,
  normalizeSuppressionChannel,
  type CrmSuppressionChannel,
} from '@/lib/data/crm/getCrmSuppressions'
import { addSuppressionAction, liftSuppressionAction } from '@/app/actions/crm-suppressions'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { SuppressionAdmin, type SuppressionRow } from '@/components/admin/crm/settings/SuppressionAdmin'

export const metadata = { title: 'Suppression list | CRM settings' }
export const dynamic = 'force-dynamic'

type SearchParams = { channel?: string; q?: string }

export default async function CrmSuppressionSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  // 'any' means no channel filter; otherwise coerce to a valid channel.
  const rawChannel = sp.channel?.trim() ?? ''
  const hasChannel = rawChannel !== '' && rawChannel !== 'any'
  const channel: CrmSuppressionChannel | undefined = hasChannel
    ? normalizeSuppressionChannel(rawChannel)
    : undefined

  const result = await getCrmSuppressions({ channel, q: q || undefined, limit: 200 })
  const rows: SuppressionRow[] = result.rows.map((r) => ({
    id: r.id,
    personId: r.personId,
    personName: r.personName,
    value: r.value,
    channel: r.channel,
    reason: r.reason,
    source: r.source,
    createdAt: r.createdAt,
    isCompliance: r.isCompliance,
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CRM settings
        </Link>
      </nav>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={result.unreadable ? 'attention' : 'ok'}>
          {result.unreadable ? (
            <>
              <b>The suppression list could not be read.</b> Every send path fails closed until it can.
            </>
          ) : (
            <>
              <b>
                {result.count.toLocaleString('en-US')}{' '}
                {result.count === 1 ? 'suppression' : 'suppressions'}.
              </b>{' '}
              Each row blocks the channel it names — email, SMS, call, or all of them. Lifting a
              compliance or litigator block is owner-only and confirm-gated.
            </>
          )}
        </VerdictLine>
      </div>

      <SectionHead>Who we must not contact</SectionHead>
      <SuppressionAdmin
        rows={rows}
        count={result.count}
        unreadable={result.unreadable}
        channelFilter={hasChannel ? (channel as CrmSuppressionChannel) : 'any'}
        query={q}
        actions={{
          add: addSuppressionAction,
          lift: liftSuppressionAction,
        }}
      />

      <SectionHead>Related</SectionHead>
      <ul className="av2-quietlist">
        <li className="av2-quiet">
          <Link
            href="/admin/crm/settings/company/block-list"
            className="av2-quiet__name"
            style={{ textDecoration: 'none', color: 'var(--a-accent)', minWidth: 190 }}
          >
            Block list
          </Link>
          <span style={{ color: 'var(--a-text-2)' }}>
            Phone numbers rejected at the Twilio webhook before a lead is ever created.
          </span>
        </li>
      </ul>
    </div>
  )
}
