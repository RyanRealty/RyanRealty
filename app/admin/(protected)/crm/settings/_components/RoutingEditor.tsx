'use client'

/**
 * RoutingEditor — the lead-routing settings editor (Wave 7).
 *
 * Edits the dormant routing engine config (strategy + default broker +
 * by_source rules) through the owner-only crm-assignment actions, passed in
 * pre-bound. Live default is all_to_one / matt — every lead goes to Matt until
 * the strategy is changed here. Changing the strategy takes effect with NO
 * deploy.
 *
 * The actions are FormData-based; this component builds the FormData and routes
 * the result through a uniform { ok, error } wrapper.
 *
 * Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every FormData key, every action call and the strategy /
 * default-broker / rule wiring below are byte-for-byte what they were. The
 * "pick one of N" rows (strategy, default broker) were shadcn Buttons whose
 * selected member carried the primary variant; they are FilterChips now, so the
 * pressed state is announced (aria-pressed) instead of implied by fill, and the
 * file keeps its single primary action ("Add rule").
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, FilterChip, SectionHead, SelectField, TextField } from '@/components/admin/v2'
import type { AssignmentStrategy, AssignmentRule } from '@/lib/data/crm/getCrmAssignmentConfig'

type Result = { ok: boolean; error?: string }
type BrokerOption = { slug: string; name: string; routingEligible: boolean }

const STRATEGY_LABEL: Record<AssignmentStrategy, string> = {
  all_to_one: 'All to one broker',
  round_robin: 'Round robin (eligible brokers)',
  by_source: 'By lead source',
}

const STRATEGY_HELP: Record<AssignmentStrategy, string> = {
  all_to_one: 'Every new lead routes to the default broker below. This is the live default.',
  round_robin: 'Each new lead rotates to the next routing-eligible broker. Eligibility is set on the Brokers page.',
  by_source: 'A lead routes by its source. Unmatched sources fall back to the default broker.',
}

/** Bordered well used for the standing note and each rule row. */
const WELL = {
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  padding: 'var(--a-s2)',
} as const

export default function RoutingEditor({
  strategy,
  defaultBroker,
  rules,
  brokers,
  setStrategyAction,
  setDefaultBrokerAction,
  upsertRuleAction,
  deleteRuleAction,
}: {
  strategy: AssignmentStrategy
  defaultBroker: string
  rules: AssignmentRule[]
  brokers: BrokerOption[]
  setStrategyAction: (formData: FormData) => Promise<Result>
  setDefaultBrokerAction: (formData: FormData) => Promise<Result>
  upsertRuleAction: (formData: FormData) => Promise<Result>
  deleteRuleAction: (formData: FormData) => Promise<Result>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newSource, setNewSource] = useState('')
  const [newBroker, setNewBroker] = useState(brokers[0]?.slug ?? '')

  const run = (build: () => FormData, action: (fd: FormData) => Promise<Result>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const res = await action(build())
      if (!res.ok) {
        setError(res.error ?? 'Could not save the change')
        return
      }
      after?.()
      router.refresh()
    })
  }

  const brokerName = (slug: string) => brokers.find((b) => b.slug === slug)?.name ?? slug

  return (
    <div className="space-y-6">
      <div
        style={{
          border: '1px solid var(--a-border)',
          background: 'var(--a-inset)',
          borderRadius: 'var(--a-r-lg)',
          padding: 'var(--a-s3)',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
        }}
      >
        The live default routes every new lead to Matt. Changing the strategy below takes effect right away, with no
        deploy.
      </div>

      {error ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}

      {/* Strategy */}
      <section aria-label="Routing strategy">
        <SectionHead>Routing strategy</SectionHead>
        <div className="av2-pane">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(Object.keys(STRATEGY_LABEL) as AssignmentStrategy[]).map((s) => (
              <FilterChip
                key={s}
                pressed={strategy === s}
                disabled={pending}
                onClick={() =>
                  run(() => {
                    const fd = new FormData()
                    fd.set('strategy', s)
                    return fd
                  }, setStrategyAction)
                }
              >
                {STRATEGY_LABEL[s]}
              </FilterChip>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{STRATEGY_HELP[strategy]}</p>
        </div>
      </section>

      {/* Default broker */}
      <section aria-label="Default broker">
        <SectionHead>Default broker</SectionHead>
        <div className="av2-pane">
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Used by All to one, and as the fallback when no source rule matches.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {brokers.map((b) => (
              <FilterChip
                key={b.slug}
                pressed={defaultBroker === b.slug}
                disabled={pending}
                onClick={() =>
                  run(() => {
                    const fd = new FormData()
                    fd.set('broker', b.slug)
                    return fd
                  }, setDefaultBrokerAction)
                }
              >
                {b.name}
              </FilterChip>
            ))}
          </div>
        </div>
      </section>

      {/* By-source rules */}
      <section aria-label="By-source rules">
        <SectionHead>By-source rules</SectionHead>
        <div className="av2-pane">
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Route a lead from a named source to a specific broker. These apply only when the strategy is By lead source.
          </p>

          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2" style={WELL}>
                  <div className="min-w-0" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
                    <span style={{ fontWeight: 500 }}>{r.source}</span>
                    <span style={{ color: 'var(--a-text-2)' }}> goes to </span>
                    <span style={{ fontWeight: 500 }}>{brokerName(r.broker)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending}
                    onClick={() =>
                      run(() => {
                        const fd = new FormData()
                        fd.set('id', String(r.id))
                        return fd
                      }, deleteRuleAction)
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>No source rules yet.</p>
          )}

          {/* Add a rule */}
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end"
            style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)', padding: 'var(--a-s3)' }}
          >
            <TextField
              label="Source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              placeholder="Zillow"
            />
            <SelectField label="Broker" value={newBroker} onChange={(e) => setNewBroker(e.target.value)}>
              {brokers.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </SelectField>
            <Button
              type="button"
              touch
              disabled={pending || !newSource.trim() || !newBroker}
              onClick={() =>
                run(
                  () => {
                    const fd = new FormData()
                    fd.set('source', newSource.trim())
                    fd.set('broker', newBroker)
                    return fd
                  },
                  upsertRuleAction,
                  () => setNewSource(''),
                )
              }
            >
              Add rule
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
