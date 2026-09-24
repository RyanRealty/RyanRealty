// @no-parity — internal admin surface, no public mockup contract
// Records audit: for every deal, each record Oregon requires the transaction
// file to hold, whether the Vault holds it, and the rule that requires it
// (lib/tc/audit/records.ts, docs/TC_RECORDS_AUDIT.md). Read-only: what a
// Real Estate Agency records inspection would ask for, answered from the
// Vault itself.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { listDealAudits, type DealAudit } from '@/lib/data/tc/deal-audit'
import type { AuditRow, AuditStatus } from '@/lib/tc/audit/records'
import { QueueRow, QuietRow, SectionHead, VerdictLine, type AdminState } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const STATUS: Record<AuditStatus, { word: string; tone: AdminState }> = {
  ok: { word: 'On file', tone: 'ok' },
  missing: { word: 'Missing', tone: 'down' },
  review: { word: 'Check', tone: 'slow' },
  na: { word: 'N/A', tone: 'waiting' },
  elsewhere: { word: 'SkySlope', tone: 'accent' },
}

const STAGE: Record<string, string> = { active_listing: 'Active listing', pending: 'Pending', closed: 'Closed', dead: 'Did not close' }
const SIDE: Record<DealAudit['side'], string> = { seller: 'seller side', buyer: 'buyer side', both: 'both sides' }

function Row({ r }: { r: AuditRow }) {
  if (r.status === 'ok') return <QuietRow name={r.requirement} state={STATUS.ok.word} figure={r.citation} />
  const s = STATUS[r.status]
  return (
    <QueueRow
      kind={s.word}
      kindTone={s.tone}
      title={r.requirement}
      context={
        <>
          {r.detail} <span style={{ color: 'var(--a-text-3)' }}>{r.citation}</span>
          {r.documents.length ? (
            <>
              <br />
              {r.documents.slice(0, 6).join(' · ')}
              {r.documents.length > 6 ? ` · and ${r.documents.length - 6} more` : ''}
            </>
          ) : null}
        </>
      }
    />
  )
}

export default async function RecordsAuditPage() {
  await requireAdminPage('transactions.view')
  const audits = await listDealAudits()
  audits.sort((a, b) => b.score.missing - a.score.missing || b.score.review - a.score.review || a.address.localeCompare(b.address))
  const total = audits.reduce((s, a) => ({ ok: s.ok + a.score.ok, missing: s.missing + a.score.missing, review: s.review + a.score.review }), { ok: 0, missing: 0, review: 0 })
  const clean = audits.filter((a) => a.score.missing === 0 && a.score.review === 0).length

  return (
    <div className="av2-scope" style={{ maxWidth: 820, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total.missing + total.review > 0 ? 'attention' : 'ok'}>
          <b>
            {audits.length} deal file{audits.length === 1 ? '' : 's'}, {clean} complete.
          </b>{' '}
          {total.ok} required records on file, {total.missing} missing, {total.review} for a person to confirm.
        </VerdictLine>
      </div>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 18px' }}>
        What an Oregon Real Estate Agency records inspection asks each transaction file for: the agency agreements and
        disclosures, every offer and counteroffer (answered or not) with its delivery and response, the executed sale
        agreement and addenda, the earnest money receipt, the settlement statement, the correspondence, and the principal
        broker&apos;s review of every document of agreement within seven banking days (OAR 863-015-0140(4), 0135, 0250;
        ORS 696.280: kept six years). Until the cutover, files that came from SkySlope are reviewed in SkySlope, which
        keeps the reviewer and date; files opened in the Vault are reviewed on Sign-off. A form counts as executed only when the document reader and the check against the
        printed form agree. Review documents on{' '}
        <Link href="/admin/sign-off" style={{ color: 'var(--a-accent)' }}>
          Sign-off
        </Link>
        .
      </p>
      {audits.map((a) => (
        <section key={a.dealId} style={{ margin: '0 0 22px' }}>
          <SectionHead>
            <Link href={`/admin/deals/${encodeURIComponent(a.propertyKey)}`} style={{ color: 'inherit' }}>
              {a.address}
            </Link>{' '}
            <span style={{ fontWeight: 400, color: 'var(--a-text-2)' }}>
              · {STAGE[a.stage] ?? a.stage} · {SIDE[a.side]}
              {a.broker ? ` · ${a.broker}` : ''} · {a.score.ok} of {a.score.applicable} on file
            </span>
          </SectionHead>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {a.rows
              .filter((r) => r.status !== 'na')
              .map((r) => (
                <Row key={r.key} r={r} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
