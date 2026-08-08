// @no-parity -- internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmBlockedNumbers } from '@/lib/data/crm/getCrmBlockedNumbers'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { BlockListManager } from '@/app/admin/(protected)/crm/settings/_components/company/BlockListManager'
import { formatDate } from '@/lib/format/date'

export const metadata = { title: 'Block list | CRM admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/company/block-list -- the §1.8 / AC-11 dedicated
 * block-list management page.
 *
 * PHONE NUMBERS: full add/remove on crm_blocked_numbers. Enforcement is live
 * today -- the Twilio inbound webhooks reject calls and drop texts from any
 * blocked number (isNumberBlocked, uncached).
 *
 * EMAILS: in-house, email blocking is the compliance suppression system
 * (crm_suppressions), which every send path already checks. This page links
 * there rather than duplicating a second, unenforced email block store.
 *
 * Access: superuser only.
 *
 * P11C: page scaffolding migrated to the LOCKED admin v2 language. The
 * BlockListManager island still owns blockCrmNumber/unblockCrmNumber verbatim.
 */
export default async function BlockListPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const blocked = await getCrmBlockedNumbers()
  // Server-format the dates (lib/format/date, LA time) so the client table
  // renders identical strings on server + client.
  const blockedOnById: Record<number, string> = {}
  for (const b of blocked) blockedOnById[b.id] = formatDate(b.createdAt)

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CRM settings
        </Link>
        <span style={{ padding: '0 6px', color: 'var(--a-text-2)' }}>/</span>
        <Link
          href="/admin/crm/settings/company"
          style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
        >
          Company
        </Link>
      </nav>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>
            {blocked.length.toLocaleString('en-US')}{' '}
            {blocked.length === 1 ? 'number is' : 'numbers are'} blocked.
          </b>{' '}
          A blocked number is rejected at the Twilio webhook: calls hang up, texts are dropped, and
          no new lead is created.
        </VerdictLine>
      </div>

      <SectionHead>Blocked phone numbers</SectionHead>
      <BlockListManager blocked={blocked} blockedOnById={blockedOnById} />

      <SectionHead>Blocking email addresses</SectionHead>
      <ul className="av2-quietlist">
        <li className="av2-quiet">
          <Link
            href="/admin/crm/settings/suppression"
            className="av2-quiet__name"
            style={{ textDecoration: 'none', color: 'var(--a-accent)', minWidth: 190 }}
          >
            Suppression list
          </Link>
          <span style={{ color: 'var(--a-text-2)' }}>
            Email blocking runs through the compliance suppression list, which every send path
            checks before sending.
          </span>
        </li>
      </ul>
    </div>
  )
}
