/**
 * Cohort sales funnel for the Performance hub Funnel tab.
 * Numbers come from getSalesFunnel / getSalesFunnelMembers only.
 */
import Link from 'next/link'
import { SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
import {
  getSalesFunnel,
  type CaptureDoorId,
  type FunnelAudience,
  type FunnelStageId,
} from '@/lib/data/analytics/getSalesFunnel'
import { getSalesFunnelMembers } from '@/lib/data/analytics/getSalesFunnelMembers'
import { isCaptureDoorId } from '@/lib/data/analytics/captureDoors'
import { DISCOVERY_GROUP_LABEL, DISCOVERY_GROUP_ORDER } from '@/lib/data/analytics/discoveryPlatforms'
import { DataList, Figures } from './v2/kit'
import { FunnelAudienceControl } from './v2/FunnelAudienceControl'
import { VariantControl } from './v2/VariantControl'
import { formatInt, formatPct } from '../_lib/formatters'
import { fetchFunnel, type DateRange } from '../_lib/queries'

const AUDIENCES: FunnelAudience[] = ['seller', 'buyer', 'recruit']
const STAGES: FunnelStageId[] = ['visited', 'engaged', 'identified', 'lead', 'working', 'client']

function parseAudience(raw: string | undefined): FunnelAudience {
  return AUDIENCES.includes(raw as FunnelAudience) ? (raw as FunnelAudience) : 'seller'
}

function parseStage(raw: string | undefined): FunnelStageId | null {
  return STAGES.includes(raw as FunnelStageId) ? (raw as FunnelStageId) : null
}

function parseDoor(raw: string | undefined): CaptureDoorId | null {
  return isCaptureDoorId(raw) ? raw : null
}

function countLabel(kind: 'people' | 'sessions' | 'events'): string {
  if (kind === 'people') return 'people'
  if (kind === 'sessions') return 'sessions'
  return 'events'
}

function funnelHref(sp: Record<string, string | undefined>, patch: Record<string, string | null>): string {
  const p = new URLSearchParams()
  p.set('tab', 'funnel')
  for (const k of ['range', 'startDate', 'endDate', 'audience', 'lpVariant'] as const) {
    if (sp[k]) p.set(k, String(sp[k]))
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k)
    else p.set(k, v)
  }
  return `/admin/analytics?${p.toString()}`
}

export async function SalesFunnelTab({
  range,
  sp,
  lpVariant,
}: {
  range: DateRange
  sp: Record<string, string | undefined>
  lpVariant: string
}) {
  const audience = parseAudience(sp.audience)
  const stage = parseStage(sp.stage)
  const door = parseDoor(sp.door)

  const [funnel, members, ga4] = await Promise.all([
    getSalesFunnel({ startDate: range.startDate, endDate: range.endDate, audience }),
    getSalesFunnelMembers({
      startDate: range.startDate,
      endDate: range.endDate,
      audience,
      stage,
      door,
    }),
    fetchFunnel(range, lpVariant || undefined),
  ])

  const leadStage = funnel.stages.find((s) => s.id === 'lead')
  const workingStage = funnel.stages.find((s) => s.id === 'working')
  const clientStage = funnel.stages.find((s) => s.id === 'client')
  const leads = leadStage?.count ?? 0
  const working = workingStage?.count ?? 0
  const clients = clientStage?.count
  const maxSpine = Math.max(1, ...funnel.stages.map((s) => s.count ?? 0))

  const audienceWord =
    audience === 'seller' ? 'seller' : audience === 'buyer' ? 'buyer' : 'broker recruit'
  let verdict: string
  if (funnel.unreadable) {
    verdict = 'The funnel could not be read. Numbers below are empty on purpose, not zero.'
  } else if (audience === 'recruit' && leads === 0 && funnel.joinConverts === 0) {
    verdict = `No broker-recruit inquiries in this window. ${formatInt(funnel.stock.activeBrokersNow)} brokers are on the team now.`
  } else if (leads === 0) {
    verdict = `No inbound ${audienceWord} leads in this window.`
  } else if (audience === 'recruit') {
    verdict = `Of ${formatInt(leads)} recruit inquiries, ${formatInt(working)} started a conversation. ${formatInt(funnel.joinConverts)} /join converts. Signed ICA is UNMEASURED. ${formatInt(funnel.stock.activeBrokersNow)} brokers are on the team now.`
  } else if (funnel.clientUnmeasured) {
    verdict = `Of ${formatInt(leads)} inbound ${audienceWord} leads, ${formatInt(working)} got a broker touch. Signed-client is UNMEASURED for this audience.`
  } else {
    verdict = `Of ${formatInt(leads)} inbound ${audienceWord} leads, ${formatInt(working)} got a broker touch. ${formatInt(clients ?? 0)} reached Listed or later.`
  }

  const tone = funnel.unreadable || (leads > 0 && !funnel.clientUnmeasured && (clients ?? 0) === 0) ? 'attention' : 'ok'

  return (
    <>
      <FunnelAudienceControl current={audience} />

      <VerdictLine tone={tone}>{verdict}</VerdictLine>

      <p className="av2-note">
        Cohort flow for {range.startDate} to {range.endDate}. Spine counts unique {audienceWord} people after a
        CRM person exists, and unique sessions before that. Capture doors are first-recorded source events.
        Addressable market is not a stage. Every platform uses its own snapshot. Those counts are never added
        together.
      </p>

      <section aria-label="Saw us">
        <SectionHead>Saw us (platform analytics, never summed)</SectionHead>
        {DISCOVERY_GROUP_ORDER.map((group) => {
          const cards = funnel.discovery.filter((ch) => ch.group === group)
          if (cards.length === 0) return null
          return (
            <div key={group} className="av2-funnel-disc-group">
              <h3 className="av2-funnel-disc-group__h">{DISCOVERY_GROUP_LABEL[group]}</h3>
              <div className="av2-funnel-disc">
                {cards.map((ch) => (
                  <div key={ch.id} className="av2-funnel-disc__item">
                    <div className="av2-funnel-disc__k">{ch.label}</div>
                    <div className="av2-funnel-disc__n">
                      {ch.count === null ? (
                        <StateWord state="waiting">UNMEASURED</StateWord>
                      ) : (
                        formatInt(Math.round(ch.count))
                      )}
                    </div>
                    <div className="av2-funnel-disc__c">
                      {ch.count === null ? null : <>{ch.metric}</>}
                      {ch.secondary
                        .filter((s) => s.count != null)
                        .map((s) => (
                          <span key={s.metric}>
                            {' · '}
                            {formatInt(Math.round(s.count ?? 0))} {s.label}
                          </span>
                        ))}
                    </div>
                    <div className="av2-funnel-disc__c">{ch.unmeasuredReason ?? ch.caveat}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <p className="av2-funnel-gap">
          Identity join from saw-us to a site visit is UNMEASURED. Those datasets do not share a person id.
        </p>
      </section>

      {funnel.ga4Sessions != null ? (
        <p className="av2-note">
          GA4 (consent-gated) reported {formatInt(Math.round(funnel.ga4Sessions))} sessions in this window.{' '}
          {funnel.ga4SessionsCaveat}
        </p>
      ) : funnel.ga4SessionsCaveat ? (
        <p className="av2-note">{funnel.ga4SessionsCaveat}</p>
      ) : null}

      {funnel.unclassifiedVisits > 0 ? (
        <p className="av2-note">
          {formatInt(funnel.unclassifiedVisits)} other visits in this window have no {audienceWord} intent tag and
          are not in this spine.
        </p>
      ) : null}

      <section aria-label="Cohort spine">
        <SectionHead>Cohort spine</SectionHead>
        <div style={{ marginBottom: 'var(--a-s4)' }}>
          {funnel.stages.map((s, i) => {
            const n = s.count
            const widthPct = n == null ? 0 : (n / maxSpine) * 100
            const href = funnelHref(sp, {
              stage: stage === s.id && !door ? null : s.id,
              door: null,
            })
            return (
              <Link
                key={s.id}
                href={href}
                className={stage === s.id && !door ? 'av2-step is-on' : 'av2-step'}
                aria-current={stage === s.id && !door ? 'page' : undefined}
              >
                <div className="av2-step__l">
                  {i + 1}. {s.label}{' '}
                  <span className="av2-funnel-kind">{countLabel(s.countKind)}</span>
                </div>
                <div className="av2-step__track">
                  <div className="av2-step__fill" style={{ width: `${Math.max(n && n > 0 ? 2 : 0, widthPct)}%` }} />
                </div>
                <div className="av2-step__n">
                  {n === null ? (
                    <StateWord state="waiting">UNMEASURED</StateWord>
                  ) : (
                    <b style={{ color: 'var(--a-text)' }}>{formatInt(n)}</b>
                  )}
                  {s.conversionFromPrev !== null ? <> · {formatPct(s.conversionFromPrev, 1)} of prior</> : null}
                  {s.unmeasuredReason ? <div className="av2-funnel-kind">{s.unmeasuredReason}</div> : null}
                </div>
              </Link>
            )
          })}
        </div>
        <p className="av2-note">
          Visited → engaged → identified is nested sessions. Lead → working → client is nested people who became
          inbound leads in this window. Visit does not nest into lead: phone, Meta lead forms, and portals skip the
          site. A conversion is only printed when the later stage is a subset of the earlier one.
        </p>
      </section>

      <section aria-label="Capture doors">
        <SectionHead>Capture doors (events)</SectionHead>
        <DataList
          label="Capture doors"
          rows={funnel.doors}
          cap={funnel.doors.length}
          rowKey={(d) => d.id}
          columns={[
            {
              key: 'door',
              header: 'Door',
              lead: true,
              cell: (d) => (
                <Link href={funnelHref(sp, { door: d.id, stage: 'lead' })} style={{ color: 'var(--a-accent)' }}>
                  {d.label}
                  {d.manual ? ' (manual)' : ''}
                </Link>
              ),
            },
            { key: 'events', header: 'Events', num: true, cell: (d) => formatInt(d.events) },
            { key: 'working', header: 'Touched', num: true, cell: (d) => formatInt(d.working) },
            {
              key: 'clients',
              header: 'Client',
              num: true,
              cell: (d) => (funnel.clientUnmeasured ? '—' : formatInt(d.clients)),
            },
          ]}
          empty={<>No attributable {audienceWord} capture events in this window.</>}
        />
        <p className="av2-note">
          First recorded source on the CRM person. A later second door is not counted here unless that source
          replaced the first. Manual entries are listed and tagged so they are not read as marketing wins. Farm,
          Import, and Sphere lists are excluded.
        </p>
      </section>

      <section aria-label="Broker books">
        <SectionHead>
          {audience === 'recruit' ? 'Their business this window' : 'By broker'}
        </SectionHead>
        <p className="av2-note">
          {audience === 'recruit'
            ? 'Each active broker’s consumer inbound leads (seller and buyer, not recruits) assigned to them in this window, plus Listed-or-later on their book. This is the business a recruit joins.'
            : `This ${audienceWord} cohort split by assigned broker.`}
        </p>
        <DataList
          label="Broker books"
          rows={funnel.brokerBooks}
          cap={funnel.brokerBooks.length}
          rowKey={(b) => b.slug}
          columns={[
            { key: 'broker', header: 'Broker', lead: true, cell: (b) => b.name },
            { key: 'leads', header: 'Inbound', num: true, cell: (b) => formatInt(b.inboundLeads) },
            { key: 'working', header: 'Touched', num: true, cell: (b) => formatInt(b.working) },
            { key: 'listed', header: 'Listed+', num: true, cell: (b) => formatInt(b.listedPlus) },
          ]}
          empty={<>No assigned inbound in this window.</>}
        />
      </section>

      <section aria-label="Now on the board">
        <SectionHead>Stock (now, not this cohort)</SectionHead>
        <Figures
          figures={[
            {
              label: 'Brokers on the team now',
              value: formatInt(funnel.stock.activeBrokersNow),
              caption: 'Active crm_active brokers',
            },
            {
              label: 'Sellers Listed or later, now',
              value: formatInt(funnel.stock.sellerListedPlusNow),
              caption: 'Current deal board, any lead date',
            },
            {
              label: 'Buyer-rep signed, now',
              value: 'UNMEASURED',
              caption: 'No signed buyer-rep writer',
            },
            {
              label: 'Referral handoffs recorded',
              value:
                funnel.stock.referralHandoffs === null ? 'no table' : formatInt(funnel.stock.referralHandoffs),
              caption: 'Signatures UNMEASURED (no signed-date column)',
            },
            ...(audience === 'recruit'
              ? [
                  {
                    label: '/join converts this window',
                    value: formatInt(funnel.joinConverts),
                    caption: 'visitor_events join_convert, not an ICA',
                  },
                ]
              : []),
          ]}
        />
      </section>

      <section aria-label="People in the selected stage">
        <SectionHead>{members.title}</SectionHead>
        {members.unmeasuredReason ? (
          <div className="av2-empty">
            <StateWord state="waiting">UNMEASURED</StateWord> {members.unmeasuredReason}
          </div>
        ) : (
          <>
            {members.note ? <p className="av2-note">{members.note}</p> : null}
            <DataList
              label={members.title}
              rows={members.members}
              cap={members.members.length}
              rowKey={(m, i) => `${m.personId ?? 'x'}-${i}`}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  lead: true,
                  cell: (m) =>
                    m.href ? (
                      <Link href={m.href} style={{ color: 'var(--a-accent)' }}>
                        {m.name}
                      </Link>
                    ) : (
                      m.name
                    ),
                },
                { key: 'door', header: 'Door', cell: (m) => m.doorLabel },
                {
                  key: 'when',
                  header: 'When',
                  num: true,
                  cell: (m) => m.createdAt.slice(0, 10),
                },
              ]}
              empty={<>{members.note ?? 'Click a stage or a door.'}</>}
            />
          </>
        )}
      </section>

      <section aria-label="Holes">
        <SectionHead>UNMEASURED on purpose</SectionHead>
        <DataList
          label="Unmeasured holes"
          rows={funnel.holes}
          cap={funnel.holes.length}
          rowKey={(h) => h.id}
          columns={[
            { key: 'hole', header: 'Hole', lead: true, cell: (h) => h.label },
            { key: 'why', header: 'Why', cell: (h) => h.reason },
          ]}
          empty={<>No holes listed.</>}
        />
      </section>

      <section aria-label="Landing-page event funnel">
        <SectionHead>
          Landing-page event funnel (GA4)
          {lpVariant ? (
            <>
              {' '}
              <StateWord state="accent">lp_variant = {lpVariant}</StateWord>
            </>
          ) : null}
        </SectionHead>
        <VariantControl variants={ga4.availableVariants} current={lpVariant} />
        <p className="av2-note">
          Event counts, not unique people. Kept as a landing-page diagnostic. It is not the cohort spine above.
        </p>
        <div style={{ marginBottom: 'var(--a-s4)' }}>
          {ga4.steps.map((step, i) => {
            const max = Math.max(1, ...ga4.steps.map((s) => s.count))
            const widthPct = (step.count / max) * 100
            return (
              <div key={step.label} className="av2-step">
                <div className="av2-step__l">
                  {i + 1}. {step.label}
                </div>
                <div className="av2-step__track">
                  <div className="av2-step__fill" style={{ width: `${Math.max(2, widthPct)}%` }} />
                </div>
                <div className="av2-step__n">
                  <b style={{ color: 'var(--a-text)' }}>{formatInt(step.count)}</b>
                  {step.dropOffPct !== null ? (
                    <>
                      {' · '}
                      {step.dropOffPct >= 0
                        ? `drop ${formatPct(step.dropOffPct, 1)}`
                        : `gain ${formatPct(-step.dropOffPct, 1)}`}
                    </>
                  ) : (
                    <> · start</>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
