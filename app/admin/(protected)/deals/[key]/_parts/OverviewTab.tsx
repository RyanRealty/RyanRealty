// @no-parity — internal admin tool (file workspace: Overview tab)
//
// One screen that answers "where does this file stand and what does it need":
// what needs a person, the key facts, the people, the latest email and the
// latest activity (Matt 2026-09-24). Everything links to the tab that holds
// the rest of it, so nothing here is a long list.
import Link from 'next/link'
import { Panel, QueueRow } from '@/components/admin/v2'
import type { TcCycle, TcDeal } from '@/app/actions/tc'
import type { TcContact } from '@/lib/tc/contact-roles'
import type { DealParty } from '@/lib/data/tc/deal-people'
import type { DealMailRow } from '@/lib/tc/mail-view'
import type { TcTaskRow } from '@/lib/data/tc/task-reads'
import { tcEventDetailPreview, tcEventLabel } from '@/lib/tc/events'
import type { AttentionItem } from '@/lib/tc/file-workspace'
import { exactMoney, shortDate } from '@/lib/tc/dashboard'
import { DealTasks } from '../DealTasks'
import type { CycleTerms } from '@/lib/data/tc/deal-terms'
import { earnestAmount } from '@/lib/tc/terms/plan'
import { ContractTerms } from './ContractTerms'

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

const withYear = (iso: string | null | undefined) => (iso ? `${shortDate(iso)}, ${String(iso).slice(0, 4)}` : null)

export function OverviewTab({
  deal,
  cycle,
  attention,
  contacts,
  parties,
  mail,
  tasks,
  terms = null,
  canEditTerms = false,
  tabHref,
}: {
  deal: TcDeal
  cycle: TcCycle | null
  attention: AttentionItem[]
  contacts: TcContact[]
  parties: DealParty[]
  mail: DealMailRow[]
  tasks: TcTaskRow[]
  /** The terms read from this cycle's contract (sale cycles). */
  terms?: CycleTerms | null
  canEditTerms?: boolean
  tabHref: (tab: string) => string
}) {
  const em = (cycle as { earnest_money?: unknown } | null)?.earnest_money
  const people: Array<{ key: string; role: string; name: string; href?: string }> = [
    ...parties.map((p) => ({
      key: `p${p.id}`,
      role: p.role === 'seller' ? 'Seller' : p.role === 'buyer' ? 'Buyer' : p.role,
      name: p.name ?? 'Unnamed',
      href: `/admin/people/${p.personId}`,
    })),
    ...(parties.length ? [] : [...(cycle?.sellers ?? []).map((n, i) => ({ key: `s${i}`, role: 'Seller', name: n })), ...(cycle?.buyers ?? []).map((n, i) => ({ key: `b${i}`, role: 'Buyer', name: n }))]),
    ...contacts.map((c) => ({ key: `c${c.id}`, role: c.role.replace(/_/g, ' '), name: [c.name, c.company].filter(Boolean).join(' · ') || 'Unnamed' })),
  ]
  const openTasks = tasks.filter((t) => t.status === 'open')

  return (
    <div className="av2-cols">
      <div className="av2-stack">
        <Panel title="Needs attention" aside={attention.length ? `${attention.length}` : null}>
          {attention.length ? (
            <ul className="av2-queue">
              {attention.map((a) => (
                  <QueueRow
                    key={a.key}
                    kind={a.kind}
                    kindTone={a.tone}
                    hot={a.tone === 'down'}
                    title={
                      <Link href={a.href} style={{ color: 'inherit' }} scroll={false}>
                        {a.title}
                      </Link>
                    }
                    context={a.context}
                    action={
                      <Link href={a.href} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }} scroll={false}>
                        {a.action}
                      </Link>
                    }
                  />
              ))}
            </ul>
          ) : (
            <p className="av2-panel__empty">Nothing on this file is waiting on anyone.</p>
          )}
        </Panel>

        <Panel title="Key facts" aside={<Link href={tabHref('money')} scroll={false}>Edit prices and dates</Link>}>
          {cycle ? (
            <dl className="av2-facts">
              <Fact label="List price" value={exactMoney(cycle.listing_price)} />
              <Fact label="Sale price" value={exactMoney(cycle.sale_price)} />
              <Fact label="Listed" value={withYear(cycle.listing_date)} />
              <Fact label="Expires" value={withYear(cycle.expiration_date)} />
              <Fact label="Accepted" value={withYear(cycle.contract_acceptance_date)} />
              <Fact label="Closing" value={withYear(cycle.actual_closing_date ?? cycle.escrow_closing_date)} />
              <Fact label="Inspection" value={cycle.inspection_days ? `${cycle.inspection_days} banking days` : null} />
              <Fact label="Financing" value={cycle.financing_days ? `${cycle.financing_days} banking days` : null} />
              <Fact label="MLS" value={cycle.mls_number ? <span style={{ fontFamily: 'var(--a-font-mono)' }}>{cycle.mls_number}</span> : null} />
              <Fact label="Escrow" value={[cycle.escrow_number, cycle.escrow_company].filter(Boolean).join(' · ') || null} />
              <Fact label="Earnest money" value={earnestAmount(em) != null ? exactMoney(earnestAmount(em)) : null} />
              <Fact label="Office gross" value={exactMoney(cycle.office_gross)} />
              <Fact label="Commission" value={cycle.commission_percent != null ? `${Number(cycle.commission_percent.toFixed(2))}%` : null} />
              <Fact label="Checklist" value={cycle.checklist_type} />
            </dl>
          ) : (
            <p className="av2-panel__empty">This file has no cycle yet, so there are no dates or prices to show.</p>
          )}
        </Panel>

        <ContractTerms state={terms} canEdit={canEditTerms} />

        {openTasks.length ? (
          <Panel title="Tasks" aside={`${openTasks.length} open`}>
            <DealTasks tasks={tasks} propertyKey={deal.property_key} />
          </Panel>
        ) : null}
      </div>

      <div className="av2-stack">
        <Panel title="People" aside={<Link href={tabHref('people')} scroll={false}>All people</Link>}>
          {people.length ? (
            <ul className="av2-feed">
              {people.slice(0, 10).map((p) => (
                <li key={p.key} className="av2-feed__row">
                  <span className="av2-feed__when" style={{ textTransform: 'capitalize' }}>
                    {p.role}
                  </span>
                  {p.href ? (
                    <Link href={p.href} className="av2-feed__what" style={{ color: 'var(--a-accent)' }}>
                      {p.name}
                    </Link>
                  ) : (
                    <span className="av2-feed__what">{p.name}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="av2-panel__empty">No one is on this file yet.</p>
          )}
        </Panel>

        <Panel title="Latest email" aside={<Link href={tabHref('email')} scroll={false}>All email</Link>}>
          {mail.length ? (
            <ul className="av2-feed">
              {mail.slice(0, 5).map((m) => (
                <li key={m.id} className="av2-feed__row">
                  <span className="av2-feed__when">{shortDate(m.sentAt.slice(0, 10))}</span>
                  <span className="av2-feed__what">{m.subject ?? '(no subject)'}</span>
                  <span className="av2-feed__more">{m.fromName ?? m.fromEmail ?? ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="av2-panel__empty">No email filed on this file yet.</p>
          )}
        </Panel>

        <Panel title="Recent activity" aside={<Link href={tabHref('activity')} scroll={false}>Full log</Link>}>
          {deal.events.length ? (
            <ul className="av2-feed">
              {deal.events.slice(0, 8).map((e) => {
                const preview = tcEventDetailPreview(e.detail)
                return (
                  <li key={e.id} className="av2-feed__row">
                    <span className="av2-feed__when">{String(e.created_at).slice(0, 16).replace('T', ' ')}</span>
                    <span className="av2-feed__what">{tcEventLabel(e.action)}</span>
                    <span className="av2-feed__more">
                      {e.actor}
                      {preview ? ` · ${preview.slice(0, 120)}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="av2-panel__empty">No activity recorded yet.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
