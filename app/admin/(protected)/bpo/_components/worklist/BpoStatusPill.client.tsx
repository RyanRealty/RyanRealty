'use client'

/**
 * BpoStatusPill — the single "what state is this opinion in" indicator,
 * shared by the worklist card and the detail panel so they can never
 * disagree (same discipline as ProspectDocPill).
 *
 * 11F: on the LOCKED admin v2 language. StateWord already carries the
 * "status is text + color, never color alone" rule (av2-state--*), so this
 * stays a thin wrapper choosing the tone. Wording is unchanged: "Final",
 * "Draft", "Build error".
 */

import { StateWord } from '@/components/admin/v2'

export function BpoStatusPill({ status, buildError }: { status: string; buildError?: string | null }) {
  if (buildError) {
    return (
      <span title={buildError}>
        <StateWord state="down">Build error</StateWord>
      </span>
    )
  }
  if (status === 'final') return <StateWord state="ok">Final</StateWord>
  return <StateWord state="waiting">Draft</StateWord>
}
