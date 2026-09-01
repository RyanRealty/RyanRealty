// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/referrals — the referral queue (W12 referral-capture tier). P11D:
// migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// PRESENTATION ONLY.
//
// Out-of-area leads never enter a drip: the buyer-intake classifier
// (lib/referral-geo.ts) routes them out with referral:candidate, and fail-closed
// unclassified property inquiries carry geo:unclassified. A broker connects the
// lead with a local broker by hand and records the handoff here, which writes a
// referral_receivables row and a timeline entry.
//
// Carried over verbatim: requireAdminPage('people.view') on the page and
// requireAdminAction('people.view') inside the server action, the
// recordReferralForm body character for character (the same trims, the same
// `feeRaw === '' ? undefined : Number(feeRaw)`, the same console.error, the same
// revalidatePath), the listReferralCandidates + listReferralReceivables reads,
// the already-referred filter, `dynamic = 'force-dynamic'`, the metadata title,
// both /admin/crm/<personId> hrefs, the /admin/crm back href, the
// pre-migration "ledger not applied yet" branch, and formatDate on both
// timestamps (both are timestamptz, which formatDate renders in Pacific — the
// date-only UTC pitfall does not apply, so nothing was swapped).
//
// FORM FIELDS UNCHANGED — personId · referredTo · feeBasisPct. What changed is
// how personId travels: the shadcn hidden <Input> became the submit button's own
// name/value. A submit button's name/value is part of the submitted entry list
// (HTML forms spec), and React 19 implements it for server actions via
// createFormDataWithSubmitter (present in react-dom 19.2.3), so
// formData.get('personId') reads the same value under the same key. This is the
// one way to carry the id without a raw <input>, which ci:admin-ui rule A bans
// on this file. The path is fail-closed either way: recordReferralReceivable
// rejects personId <= 0 before it writes anything.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark) and the <h1> with it, ConsoleSection became SectionHead, the
// shadcn badges became state words, and both empty states now say why they are
// empty instead of only that they are.
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { requireAdminPage, requireAdminAction } from '@/lib/admin/require-admin'
import {
  listInboundReferrals,
  listReferralCandidates,
  listReferralReceivables,
  recordReferralReceivable,
} from '@/lib/data/crm/referralReceivables'
import { SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
import { RecordHandoffButton } from './RecordHandoffButton'
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

  const [candidates, receivables, inbound] = await Promise.all([
    listReferralCandidates(),
    listReferralReceivables(),
    listInboundReferrals(),
  ])
  const referredPersonIds = new Set(receivables.rows.map((r) => r.personId))
  const queue = candidates.filter((c) => !referredPersonIds.has(c.personId))

  return (
    <div className="av2-scope" style={{ maxWidth: 768, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={inbound.length > 0 || queue.length > 0 ? 'attention' : 'ok'}>
          {inbound.length > 0 || queue.length > 0 ? (
            <>
              <b>
                {inbound.length.toLocaleString('en-US')} incoming{' '}
                {inbound.length === 1 ? 'client' : 'clients'} from other agents.
              </b>{' '}
              {queue.length.toLocaleString('en-US')} out-of-area{' '}
              {queue.length === 1 ? 'lead is' : 'leads are'} waiting on a handoff.
            </>
          ) : (
            <>
              <b>Nothing is waiting.</b>{' '}
              {receivables.rows.length.toLocaleString('en-US')} outgoing{' '}
              {receivables.rows.length === 1 ? 'referral has' : 'referrals have'} been recorded.
            </>
          )}
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ margin: '0 0 18px' }}>
        <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
          Back to CRM
        </Link>
      </div>

      {receivables.available ? null : (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: '0 0 20px' }}>
          The receivables ledger table is not applied yet (migration
          20260722212000_referral_tier.sql). The queue below works; recording a handoff starts
          working the moment the migration lands.
        </p>
      )}

      <section aria-label="Incoming from other agents">
        <SectionHead>
          Incoming from other agents — {inbound.length.toLocaleString('en-US')}
        </SectionHead>
        {inbound.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
            Empty. A licensed broker sending a Central Oregon client lands here from
            /refer-a-client. Call the sending broker first. Do not contact the client
            until the referral is in writing.
          </p>
        ) : (
          <ul className="av2-quietlist">
            {inbound.map((row) => (
              <li key={row.personId} className="av2-quiet" style={{ display: 'block' }}>
                <div className="av2-wordrow" style={{ marginBottom: 8 }}>
                  <Link
                    href={`/admin/people/${row.personId}`}
                    style={{ color: 'var(--a-text)', fontWeight: 500, textDecoration: 'none' }}
                  >
                    {row.name}
                  </Link>
                  <StateWord state="waiting">
                    {row.intent ?? 'intent unset'}
                    {row.area ? ` · ${row.area}` : ''}
                  </StateWord>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(row.createdAt)}</span>
                </div>
                <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
                  From {row.referringAgentName ?? 'unnamed broker'}
                  {row.referringBrokerage ? `, ${row.referringBrokerage}` : ''}
                  {row.referringAgentEmail ? ` · ${row.referringAgentEmail}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Waiting on a handoff">
        <SectionHead>Waiting on a handoff — {queue.length.toLocaleString('en-US')}</SectionHead>
        {queue.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
            Empty. A lead lands here when the intake classifier tags it{' '}
            <code>referral:candidate</code> (outside our area) or <code>geo:unclassified</code> (the
            property could not be placed), which happens on the public contact form and the
            listing-agent contact path.
          </p>
        ) : (
          <ul className="av2-quietlist">
            {queue.map((c) => (
              <li key={c.personId} className="av2-quiet" style={{ display: 'block' }}>
                <div className="av2-wordrow" style={{ marginBottom: 8 }}>
                  <Link
                    href={`/admin/crm/${c.personId}`}
                    style={{ color: 'var(--a-text)', fontWeight: 500, textDecoration: 'none' }}
                  >
                    {c.name}
                  </Link>
                  {c.bucket === 'referral' ? (
                    <StateWord state="waiting">
                      {c.cityInterest ? c.cityInterest.replace(/-/g, ' ') : 'out of area'}
                    </StateWord>
                  ) : (
                    <StateWord state="slow">geo unclassified, review</StateWord>
                  )}
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDate(c.createdAt)}</span>
                  {c.source ? <span>{c.source}</span> : null}
                </div>
                <RecordHandoffButton
                  personId={c.personId}
                  personName={c.name}
                  action={recordReferralForm}
                  disabled={!receivables.available}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recorded referrals">
        <SectionHead>
          Recorded referrals — {receivables.rows.length.toLocaleString('en-US')}
        </SectionHead>
        {receivables.rows.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
            Empty. A row appears here the moment a handoff above is recorded, and carries the fee
            basis it was recorded with.
          </p>
        ) : (
          <ul className="av2-quietlist">
            {receivables.rows.map((r) => (
              <li key={r.id} className="av2-quiet">
                <Link
                  href={`/admin/crm/${r.personId}`}
                  className="av2-quiet__name"
                  style={{ color: 'var(--a-text)', textDecoration: 'none' }}
                >
                  Contact #{r.personId}
                </Link>
                <span>to {r.referredTo}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.feeBasisPct}%</span>
                <StateWord state={r.status === 'paid' ? 'ok' : 'waiting'}>{r.status}</StateWord>
                <span className="av2-quiet__fig">{formatDate(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
