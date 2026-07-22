// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/crm/referrals — the referral queue (W12 referral-capture tier).
 *
 * Disposition surface for out-of-area leads: everyone the buyer-intake
 * classifier (lib/referral-geo.ts) routed OUT of the standard drip
 * (referral:candidate) plus fail-closed unclassified property inquiries
 * (geo:unclassified). A broker connects the lead with a local broker by hand
 * and records the handoff here, which writes a referral_receivables row
 * (fee_basis_pct, default 25) and a timeline entry.
 *
 * referral_receivables lands via migration 20260722212000_referral_tier.sql;
 * the DAL feature-detects, so pre-migration this page renders the queue and a
 * plain "ledger not applied yet" note instead of erroring.
 */
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { requireAdminPage, requireAdminAction } from '@/lib/admin/require-admin'
import {
  listReferralCandidates,
  listReferralReceivables,
  recordReferralReceivable,
} from '@/lib/data/crm/referralReceivables'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { formatDate } from '@/lib/format/date'

export const metadata = { title: 'Referral queue | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function recordReferralForm(formData: FormData): Promise<void> {
  'use server'
  await requireAdminAction('people.view')
  const personId = Number(formData.get('personId'))
  const referredTo = (formData.get('referredTo') as string | null)?.trim() ?? ''
  const feeRaw = (formData.get('feeBasisPct') as string | null)?.trim() ?? ''
  const feeBasisPct = feeRaw === '' ? undefined : Number(feeRaw)
  const r = await recordReferralReceivable({ personId, referredTo, feeBasisPct })
  if (!r.ok) console.error('[crm] recordReferralReceivable failed:', r.error)
  revalidatePath('/admin/crm/referrals')
}

export default async function CrmReferralsPage() {
  // requireAdminPage('people.view') is the full gate: redirects to /auth-error
  // (no session) or /admin/access-denied (no people.view capability).
  await requireAdminPage('people.view')

  const [candidates, receivables] = await Promise.all([
    listReferralCandidates(),
    listReferralReceivables(),
  ])
  const referredPersonIds = new Set(receivables.rows.map((r) => r.personId))
  const queue = candidates.filter((c) => !referredPersonIds.has(c.personId))

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0">
          Back to CRM
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Referral queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Out-of-area leads never enter a drip. Connect each one with a local broker, then record the
        handoff so the referral fee has a paper trail.
      </p>

      {receivables.available ? null : (
        <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          The receivables ledger table is not applied yet (migration
          20260722212000_referral_tier.sql). The queue below works; recording a handoff starts
          working the moment the migration lands.
        </p>
      )}

      <div className="mt-6 space-y-5">
        <ConsoleSection title={`Waiting on a handoff (${queue.length})`}>
          {queue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing waiting. Out-of-area inquiries land here automatically.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((c) => (
                <li key={c.personId} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/crm/${c.personId}`} className="font-medium text-foreground hover:underline">
                      {c.name}
                    </Link>
                    {c.bucket === 'referral' ? (
                      <Badge variant="secondary">
                        {c.cityInterest ? c.cityInterest.replace(/-/g, ' ') : 'out of area'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">geo unclassified, review</Badge>
                    )}
                    <span className="text-xs tabular-nums text-muted-foreground">{formatDate(c.createdAt)}</span>
                    {c.source ? <span className="text-xs text-muted-foreground">{c.source}</span> : null}
                  </div>
                  <form action={recordReferralForm} className="mt-3 flex flex-wrap items-center gap-2">
                    <Input type="hidden" name="personId" value={c.personId} readOnly className="hidden" />
                    <Input
                      name="referredTo"
                      required
                      placeholder="Referred to (broker, brokerage)"
                      className="h-9 w-64 max-w-full"
                    />
                    <Input
                      name="feeBasisPct"
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      placeholder="25"
                      aria-label="Referral fee percent"
                      className="h-9 w-20 tabular-nums"
                    />
                    <Button type="submit" size="sm" disabled={!receivables.available}>
                      Record handoff
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </ConsoleSection>

        <ConsoleSection title={`Recorded referrals (${receivables.rows.length})`}>
          {receivables.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No referrals recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {receivables.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  <Link href={`/admin/crm/${r.personId}`} className="font-medium text-foreground hover:underline">
                    Contact #{r.personId}
                  </Link>
                  <span className="text-muted-foreground">to {r.referredTo}</span>
                  <span className="tabular-nums text-muted-foreground">{r.feeBasisPct}%</span>
                  <Badge variant="outline">{r.status}</Badge>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </ConsoleSection>
      </div>
    </main>
  )
}
