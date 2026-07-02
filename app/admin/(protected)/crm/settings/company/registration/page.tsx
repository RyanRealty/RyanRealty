// @no-parity -- internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { getA2pCampaignStatus } from '@/lib/crm/twilio'
import { CRM_BROKERS } from '@/lib/crm/constants'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export const metadata = { title: 'Business registration | CRM admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/company/registration -- the §1.10 / AC-12 Business
 * Registration status page.
 *
 * In-house, business registration IS the Twilio A2P 10DLC brand + campaign that
 * gates outbound SMS (carriers reject texts with error 30034 until VERIFIED).
 * The badge below is the LIVE campaign status pulled from Twilio
 * (getA2pCampaignStatus, 5-minute TTL) -- the same status the composer's
 * fail-closed SMS gate checks before any text sends. One registration covers
 * every broker line; numbers added later inherit it automatically.
 *
 * Access: superuser only.
 */

const BADGES: Record<string, { label: string; className: string; blurb: string }> = {
  VERIFIED: {
    label: 'Fully Registered',
    className: 'bg-success text-success-foreground',
    blurb: 'The A2P 10DLC campaign is carrier-approved. Outbound texting is enabled on every registered line.',
  },
  IN_PROGRESS: {
    label: 'Under Carrier Review',
    className: 'bg-warning text-warning-foreground',
    blurb: 'Submitted to US carriers for approval. Outbound SMS stays blocked (fail closed) until VERIFIED.',
  },
  PENDING: {
    label: 'Under Carrier Review',
    className: 'bg-warning text-warning-foreground',
    blurb: 'Submitted to US carriers for approval. Outbound SMS stays blocked (fail closed) until VERIFIED.',
  },
  FAILED: {
    label: 'Rejected by Carriers',
    className: 'bg-destructive text-destructive-foreground',
    blurb: 'The carriers declined the campaign. Correct the business info in the Twilio console and resubmit.',
  },
  NONE: {
    label: 'Not Started',
    className: 'bg-secondary text-secondary-foreground',
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
    className: 'bg-secondary text-secondary-foreground',
    blurb: 'Twilio did not return a campaign status. Retry shortly, or check the Twilio console.',
  }

  const lines = CRM_BROKERS.map((slug) => ({
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    number: telephony?.bySlug[slug]?.twilioNumber ?? null,
  }))

  return (
    <SettingsSubpageShell
      title="Business registration"
      description="A2P 10DLC brand + campaign status for SMS compliance. Carriers block outbound texting until the campaign is fully registered."
    >
      <div className="space-y-6">
        <Card className="p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Campaign status (live from Twilio)</p>
              <div className="mt-2 flex items-center gap-3">
                <Badge className={badge.className}>{badge.label}</Badge>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Twilio status: {status ?? 'unavailable'}
                </span>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/crm/settings/company">Back to Company Settings</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{badge.blurb}</p>
        </Card>

        <Card className="p-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Registered lines</p>
          <p className="mt-1 text-xs text-muted-foreground">
            One registration covers every line on the account. Numbers added later inherit it automatically.
          </p>
          <ul className="mt-3 space-y-1.5">
            {lines.map((l) => (
              <li key={l.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{l.name}</span>
                <span className="tabular-nums text-muted-foreground">{l.number ?? '—'}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Registration requirements</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {REQUIREMENTS.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      </div>
    </SettingsSubpageShell>
  )
}
