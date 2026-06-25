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
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
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
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        The live default routes every new lead to Matt. Changing the strategy below takes effect right away, with no
        deploy.
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      {/* Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routing strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(Object.keys(STRATEGY_LABEL) as AssignmentStrategy[]).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={strategy === s ? 'default' : 'outline'}
                disabled={pending}
                className={cn('h-10 justify-start sm:h-9')}
                onClick={() =>
                  run(() => {
                    const fd = new FormData()
                    fd.set('strategy', s)
                    return fd
                  }, setStrategyAction)
                }
              >
                {STRATEGY_LABEL[s]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{STRATEGY_HELP[strategy]}</p>
        </CardContent>
      </Card>

      {/* Default broker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default broker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Used by All to one, and as the fallback when no source rule matches.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {brokers.map((b) => (
              <Button
                key={b.slug}
                type="button"
                size="sm"
                variant={defaultBroker === b.slug ? 'default' : 'outline'}
                disabled={pending}
                className="h-10 sm:h-9"
                onClick={() =>
                  run(() => {
                    const fd = new FormData()
                    fd.set('broker', b.slug)
                    return fd
                  }, setDefaultBrokerAction)
                }
              >
                {b.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By-source rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By-source rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Route a lead from a named source to a specific broker. These apply only when the strategy is By lead source.
          </p>

          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2"
                >
                  <div className="min-w-0 text-sm text-foreground">
                    <span className="font-medium">{r.source}</span>
                    <span className="text-muted-foreground"> goes to </span>
                    <span className="font-medium">{brokerName(r.broker)}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2.5 text-destructive sm:h-8"
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
            <p className="text-sm text-muted-foreground">No source rules yet.</p>
          )}

          {/* Add a rule */}
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-3 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="rule-source">Source</Label>
              <Input
                id="rule-source"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="Zillow"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-broker">Broker</Label>
              <Select value={newBroker} onValueChange={setNewBroker}>
                <SelectTrigger id="rule-broker">
                  <SelectValue placeholder="Select a broker" />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pending || !newSource.trim() || !newBroker}
              className="h-10 sm:h-9"
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
        </CardContent>
      </Card>
    </div>
  )
}
