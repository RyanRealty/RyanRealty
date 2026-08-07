// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/deals/[id] — the deal ENTITY page (ADMIN_UI.md pattern 5:
// identity header + stacked context sections).
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — DealHeader / DealMilestones / DealCommission / DealFiles
// are mounted UNCHANGED, so no commission figure, split percentage, dollar
// amount or milestone date can move through this change.
//
// TWO NON-PRESENTATION FIXES landed with the migration, both pre-existing:
//   1. The broker-scope guard below. This page ran only a session check, so a
//      restricted broker could walk sequential ids and read any deal's GCI,
//      commission percent and split rows. The board and every deal mutation
//      already applied dealInScope; this reader did not.
//   2. generateMetadata's title precedence (see the comment there).
//
// The `fmt` date formatter is deliberately NOT routed through lib/format/date.
// It parses `<date>T00:00:00` as LOCAL time and formats in the system zone,
// which on a UTC server prints the stored calendar day. formatDate parses a
// date-only string as UTC midnight and re-projects it to America/Los_Angeles,
// which moves the printed day BACK BY ONE. That is a §0 figure change, not a
// presentation change, so the file stays on the ci:date-format baseline.
//
// Carried over verbatim: the
// `params: Promise<{id}>` signature and `await params`, the Number(id) /
// `if (!numId) notFound()` guard, the getCrmAccess guard and its
// redirect('/admin/access-denied'), getCrmDeal + `if (!deal) notFound()`, the
// dealLabel fallback chain (name → person.name → `Deal #id`), the `fmt`
// date formatter character for character, every prop object handed to the four
// client editors (including the milestone bundle), the /admin/crm and
// /admin/crm/deals breadcrumb hrefs, the /admin/crm/${deal.person_id} contact
// href, and the ID / stage-since / MLS / status meta strip.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the deal's name moved out of dead breadcrumb text into the
// EntityTitle primitive, the five shadcn ConsoleSection cards became v2 lane
// heads over the same editors, and the contact's NAME is now the door to
// /admin/crm/${deal.person_id} (acceptance bar rule 3) instead of a separate
// "View contact →" affordance on the same href.
//
// `fmt` is deliberately NOT routed through lib/format/date: it reads the UTC
// calendar day out of entered_stage_at and prints it without a zone shift.
// formatDate would re-project that instant into America/Los_Angeles and move
// the printed day back by one — a §0 figure change, not a presentation change.
// The file was already on the ci:date-format baseline and stays there.
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { dealInScope } from '@/lib/crm/deal-scope'
import { getCrmDeal } from '@/lib/data/crm/getCrmDeal'
import { EntityTitle, SectionHead } from '@/components/admin/v2'
import { DealHeader } from './DealHeader'
import { DealMilestones } from './DealMilestones'
import { DealCommission } from './DealCommission'
import { DealFiles } from './DealFiles'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getCrmDeal(Number(id))
  // `??` binds looser than `+`, so the old expression parsed as
  // `deal?.name ?? ('Deal #id' + ' | CRM | Admin')` — every NAMED deal got a
  // bare tab title and only the unnamed fallback carried the suffix.
  return { title: `${deal?.name ?? `Deal #${id}`} | CRM | Admin` }
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numId = Number(id)
  if (!numId) notFound()

  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const deal = await getCrmDeal(numId)
  if (!deal) notFound()

  // Broker scope. This page had only the session check above, so a restricted
  // broker could walk sequential ids and read any deal's GCI, commission
  // percent and every split row. The board page and every deal mutation already
  // run this exact rule (lib/crm/deal-scope.ts); this page was the one reader
  // that did not. notFound() rather than access-denied, so the response cannot
  // be used to probe which deal ids exist.
  if (!dealInScope(scopeBroker(access), deal.assigned_broker, deal.person?.assigned_broker ?? null)) {
    notFound()
  }

  const dealLabel = deal.name ?? deal.person?.name ?? `Deal #${deal.id}`

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ margin: '0 0 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin/crm" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CRM
        </Link>
        <span style={{ padding: '0 6px' }}>/</span>
        <Link href="/admin/crm/deals" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Pipeline
        </Link>
      </nav>

      <EntityTitle>{dealLabel}</EntityTitle>

      {/* ── Header: name / address / price / close date / description ─── */}
      <section aria-label="Deal">
        <SectionHead>Deal</SectionHead>
        <DealHeader
          dealId={deal.id}
          initialName={deal.name}
          initialAddress={deal.property_address}
          initialValue={deal.value}
          initialCloseDate={deal.close_date}
          initialDescription={deal.description}
          stage={deal.stage}
          pipeline={deal.pipeline}
        />
      </section>

      {/* ── Milestones ─────────────────────────────────────────────────── */}
      <section aria-label="Milestone dates">
        <SectionHead>Milestone dates</SectionHead>
        <DealMilestones
          dealId={deal.id}
          initial={{
            mutual_acceptance: deal.mutual_acceptance,
            earnest_money_due: deal.earnest_money_due,
            due_diligence: deal.due_diligence,
            final_walkthrough: deal.final_walkthrough,
            possession: deal.possession,
          }}
        />
      </section>

      {/* ── Commission + splits (editor mounted unchanged — §0) ─────────── */}
      <section aria-label="Commission">
        <SectionHead>Commission</SectionHead>
        <DealCommission
          dealId={deal.id}
          initialCommissionDollars={deal.commission_dollars}
          initialCommissionPercent={deal.commission_percent}
          splits={deal.splits}
        />
      </section>

      {/* ── People ─────────────────────────────────────────────────────── */}
      <section aria-label="People">
        <SectionHead>People</SectionHead>
        {deal.person ? (
          <div className="av2-quiet">
            <Link
              href={`/admin/crm/${deal.person_id}`}
              className="av2-quiet__name"
              style={{ color: 'var(--a-accent)', textDecoration: 'none' }}
            >
              {deal.person.name ?? 'Unnamed contact'}
            </Link>
            {deal.person.assigned_broker ? (
              <span
                style={{
                  fontSize: 'var(--a-text-sm)',
                  color: 'var(--a-text-2)',
                  textTransform: 'capitalize',
                }}
              >
                {deal.person.assigned_broker}
              </span>
            ) : null}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
            No contact linked.
          </p>
        )}
      </section>

      {/* ── Files ──────────────────────────────────────────────────────── */}
      <section aria-label="Files">
        <SectionHead>{deal.files.length ? `Files (${deal.files.length})` : 'Files'}</SectionHead>
        <DealFiles dealId={deal.id} files={deal.files} />
      </section>

      {/* ── Meta strip ─────────────────────────────────────────────────── */}
      <p
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 24px',
          margin: '24px 0 0',
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
        }}
      >
        <span>ID {deal.id}</span>
        {deal.entered_stage_at ? (
          <span>Stage since {fmt(deal.entered_stage_at.slice(0, 10))}</span>
        ) : null}
        {deal.listing_key ? <span>MLS {deal.listing_key}</span> : null}
        {deal.status ? <span>Status: {deal.status}</span> : null}
      </p>
    </div>
  )
}
