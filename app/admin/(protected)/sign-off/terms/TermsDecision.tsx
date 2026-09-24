'use client'

// @no-parity — internal admin tool (principal broker: contract terms review)
//
// The decision on the term on screen, then straight to the next one, the way
// review mode works (../review/ReviewDecision.tsx). Two kinds:
//   - a typed value the contract disagrees with: use the contract's value, or
//     keep the file's (Matt 2026-09-24: "Contract wins, unless a person typed it");
//   - a term the readers still split on after the third read: pick the reading
//     that matches the page beside it.
// J and K step through the queue; no key decides anything.
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/v2'
import { settleTermConflict, settleTermReading } from '@/app/actions/tc-deal-terms'

type Choice = { label: string; run: () => Promise<{ ok: boolean; error?: string }>; quiet?: boolean }

export function TermsDecision(
  props: (
    | { kind: 'conflict'; cycleId: string; column: string; current: string; contract: string }
    | { kind: 'unsettled'; documentId: string; instrument: number; field: string; readings: Array<{ value: unknown; display: string; readers: string[] }> }
  ) & { afterHref: string; prevHref: string | null; nextHref: string | null },
) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { prevHref, nextHref, afterHref } = props

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      const key = e.key.toLowerCase()
      if (key === 'j' && nextHref) router.push(nextHref, { scroll: false })
      if (key === 'k' && prevHref) router.push(prevHref, { scroll: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, nextHref, prevHref])

  const choices: Choice[] =
    props.kind === 'conflict'
      ? [
          { label: `Use the contract: ${props.contract}`, run: () => settleTermConflict({ cycleId: props.cycleId, column: props.column, choice: 'contract' }) },
          { label: `Keep the file: ${props.current}`, run: () => settleTermConflict({ cycleId: props.cycleId, column: props.column, choice: 'file' }), quiet: true },
        ]
      : // A split has no favorite: every reading gets the same weight.
        props.readings.map((r) => ({
          label: r.display,
          run: () => settleTermReading({ documentId: props.documentId, instrument: props.instrument, field: props.field, value: r.value }),
          quiet: true,
        }))

  const decide = (c: Choice) =>
    startTransition(async () => {
      setError(null)
      const res = await c.run()
      if (!res.ok) {
        setError(res.error || 'That was not saved. Try again.')
        return
      }
      router.push(afterHref, { scroll: false })
      router.refresh()
    })

  return (
    <div className="av2-review__decide">
      <div className="av2-review__row" style={{ flexWrap: 'wrap' }}>
        {choices.map((c) => (
          <Button key={c.label} touch variant={c.quiet ? 'quiet' : undefined} disabled={pending} onClick={() => decide(c)}>
            {pending ? 'Saving…' : c.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="av2-review__error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
