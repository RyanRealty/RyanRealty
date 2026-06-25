// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getCrmSuppressions,
  normalizeSuppressionChannel,
  type CrmSuppressionChannel,
} from '@/lib/data/crm/getCrmSuppressions'
import { addSuppressionAction, liftSuppressionAction } from '@/app/actions/crm-suppressions'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
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
    <SettingsSubpageShell
      title="Suppression list"
      description="Who is blocked from email, SMS, or calls and why. Lifting a compliance or litigator block is owner-only and confirm-gated."
    >
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
    </SettingsSubpageShell>
  )
}
