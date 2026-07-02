// @no-parity -- internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmBlockedNumbers } from '@/lib/data/crm/getCrmBlockedNumbers'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { BlockListManager } from '@/components/admin/crm/settings/company/BlockListManager'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
    <SettingsSubpageShell
      title="Block list"
      description="Blocked phone numbers are rejected at the Twilio webhook: calls hang up, texts are dropped, and no new lead is created."
    >
      <div className="space-y-6">
        <BlockListManager blocked={blocked} blockedOnById={blockedOnById} />

        <Card className="p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Blocking email addresses</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Email blocking runs through the compliance suppression list, which every
            send path checks before sending.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3 self-start">
            <Link href="/admin/crm/settings/suppression">Manage email suppressions</Link>
          </Button>
        </Card>
      </div>
    </SettingsSubpageShell>
  )
}
