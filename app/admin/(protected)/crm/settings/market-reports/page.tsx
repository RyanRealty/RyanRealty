// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/crm/settings/market-reports — who receives the recurring market
 * report (P11C migration onto the locked v2 admin language).
 *
 * The daily send cron mails each contact on their chosen cadence, with every
 * figure pulled live from the market cache. This surface reads that roster,
 * offers a sample preview, and (superuser only) the bulk audience send.
 *
 * Layout (ADMIN_UI.md): verdict first, then the queue rows — every subscriber
 * name is a door to their person page, every state is a plain word.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getMarketReportSubscribers } from '@/lib/data/crm/getMarketReportSubscribers'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { MarketReportPreviewDialog } from '@/components/admin/crm/settings/MarketReportPreviewDialog'
import { QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import BulkSendForm from './BulkSendForm'

export const metadata = { title: 'Market-report subscribers | CRM settings' }
export const dynamic = 'force-dynamic'

/** Resolve area slugs to their registry labels for display. */
function areaLabels(slugs: string[]): string {
  const catalog = buildMarketReportAreas()
  const bySlug = new Map(catalog.map((a) => [a.slug, a.label]))
  return slugs.map((s) => bySlug.get(s) ?? s).join(', ')
}

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export default async function CrmMarketReportSubscribersPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  // Superusers see every subscriber; a broker sees only their own contacts.
  const scope = access.role === 'superuser' ? null : access.brokerSlug
  const subscribers = await getMarketReportSubscribers(scope)

  const activeCount = subscribers.filter((s) => s.isActive).length
  // The subscribable-area registry drives BOTH the "areas in this report" picker
  // and the "subscribed to" audience filter, so a bulk send can only ever name an
  // area the cache actually reports on.
  const areaOptions = buildMarketReportAreas().map((a) => ({ slug: a.slug, label: a.label }))
  // Bulk send reaches the company-wide book, so only a superuser gets the control
  // (the server actions enforce the same bar; this just hides a dead button).
  const canBulkSend = access.role === 'superuser'

  return (
    <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 0 14px',
        }}
      >
        <VerdictLine tone="ok">
          <b>
            {subscribers.length.toLocaleString('en-US')}{' '}
            {subscribers.length === 1 ? 'subscriber' : 'subscribers'}, {activeCount} active.
          </b>{' '}
          The daily cron mails each one on their cadence, every figure pulled live from the market cache.
        </VerdictLine>
        <Link
          href="/admin/crm/settings"
          style={{ color: 'var(--a-accent)', textDecoration: 'none', fontSize: 'var(--a-text-sm)' }}
        >
          Back to settings
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-surface)',
          padding: 'var(--a-s3) var(--a-s4)',
        }}
      >
        <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>
          See exactly what a subscriber receives, with the verification trace for every figure.
        </span>
        <MarketReportPreviewDialog
          areas={['bend']}
          label="Preview a sample report (Bend)"
          variant="outline"
          size="default"
        />
      </div>

      {canBulkSend ? <BulkSendForm areaOptions={areaOptions} /> : null}

      <SectionHead>Subscribers</SectionHead>
      {subscribers.length === 0 ? (
        <p style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)', padding: '12px 2px' }}>
          No market-report subscribers yet. A contact subscribes from their CRM record card.
        </p>
      ) : (
        <ul className="av2-queue">
          {subscribers.map((s) => (
            <QueueRow
              key={s.subscriptionId}
              kind={s.isActive ? 'Active' : 'Paused'}
              kindTone={s.isActive ? 'ok' : 'waiting'}
              title={
                <Link
                  href={`/admin/people/${s.personId}`}
                  style={{ color: 'var(--a-text)', textDecoration: 'none' }}
                >
                  {s.personName ?? `Contact ${s.personId}`}
                </Link>
              }
              context={
                <>
                  {s.areas.length > 0 ? areaLabels(s.areas) : 'No areas'} ·{' '}
                  {FREQUENCY_LABEL[s.frequency] ?? s.frequency}
                </>
              }
              age={s.lastSentAt ? formatDate(s.lastSentAt) : 'Never sent'}
              action={<MarketReportPreviewDialog areas={s.areas} contactName={s.personName} />}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
