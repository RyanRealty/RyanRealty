// @no-parity -- internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { getA2pCampaignStatus } from '@/lib/crm/twilio'
import { CRM_BROKERS } from '@/lib/crm/constants'
import { SectionHead, StateWord, VerdictLine, type AdminState } from '@/components/admin/v2'

export const metadata = { title: 'Business registration | CRM admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/company/registration -- the §1.10 / AC-12 Business
 * Registration status page.
 *
 * In-house, business registration IS the Twilio A2P 10DLC brand + campaign that
 * gates outbound SMS (carriers reject texts with error 30034 until VERIFIED).
 * The state word below is the LIVE campaign status pulled from Twilio
 * (getA2pCampaignStatus, 5-minute TTL) -- the same status the composer's
 * fail-closed SMS gate checks before any text sends. One registration covers
 * every broker line; numbers added later inherit it automatically.
 *
 * Access: superuser only.
 *
 * P11C: migrated to the LOCKED admin v2 language. Status is a StateWord (text +
 * color, never color alone) instead of a shadcn Badge; the data reads, the
 * guard, and every href are unchanged.
 */

const BADGES: Record<string, { label: string; state: AdminState; blurb: string }> = {
  VERIFIED: {
    label: 'Fully Registered',
    state: 'ok',
    blurb: 'The A2P 10DLC campaign is carrier-approved. Outbound texting is enabled on every registered line.',
  },
  IN_PROGRESS: {
    label: 'Under Carrier Review',
    state: 'slow',
    blurb: 'Submitted to US carriers for approval. Outbound SMS stays blocked (fail closed) until VERIFIED.',
  },
  PENDING: {
    label: 'Under Carrier Review',
    state: 'slow',
    blurb: 'Submitted to US carriers for approval. Outbound SMS stays blocked (fail closed) until VERIFIED.',
  },
  FAILED: {
    label: 'Rejected by Carriers',
    state: 'down',
    blurb: 'The carriers declined the campaign. Correct the business info in the Twilio console and resubmit.',
  },
  NONE: {
    label: 'Not Started',
    state: 'waiting',
    blurb: 'No A2P campaign found on the messaging service. Outbound SMS is blocked until one is registered and VERIFIED.',
  },
}

const REQUIREMENTS = [
  'Valid EIN matching IRS records exactly (legal name + address)',
  'Website with opt-in consent language on the primary contact form',
  'Privacy policy stating collected numbers are not shared for marketing',
  'SMS terms covering STOP cancellation, HELP support, and message rates',
]

export default async function BusinessRegistrationPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [status, telephony] = await Promise.all([
    getA2pCampaignStatus().catch(() => null),
    getBrokerTelephony().catch(() => null),
  ])

  const badge = BADGES[status ?? ''] ?? {
    label: 'Status unavailable',
    state: 'waiting' as AdminState,
    blurb: 'Twilio did not return a campaign status. Retry shortly, or check the Twilio console.',
  }

  const lines = CRM_BROKERS.map((slug) => ({
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    number: telephony?.bySlug[slug]?.twilioNumber ?? null,
  }))

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

      <div style={{ margin: '0 0 10px' }}>
        <VerdictLine tone={status === 'VERIFIED' ? 'ok' : 'attention'}>
          <b>Outbound SMS is {status === 'VERIFIED' ? 'registered' : 'not cleared to send'}.</b>{' '}
          {badge.blurb}
        </VerdictLine>
      </div>

      <p className="av2-wordrow" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        <StateWord state={badge.state}>{badge.label}</StateWord>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          Twilio campaign status (live): {status ?? 'unavailable'}
        </span>
      </p>

      <SectionHead>Registered lines</SectionHead>
      <ul className="av2-quietlist">
        {lines.map((l) => (
          <li key={l.name} className="av2-quiet">
            <span className="av2-quiet__name">{l.name}</span>
            <span className="av2-quiet__fig" style={{ fontFamily: 'var(--a-font-mono)' }}>
              {l.number ?? '—'}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: -8 }}>
        One registration covers every line on the account. Numbers added later inherit it
        automatically.
      </p>

      <SectionHead>Registration requirements</SectionHead>
      <ul className="av2-quietlist">
        {REQUIREMENTS.map((r) => (
          <li key={r} className="av2-quiet">
            <span style={{ color: 'var(--a-text)' }}>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
