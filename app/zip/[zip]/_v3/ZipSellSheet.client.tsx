'use client'

/**
 * The ZIP page's seller door, as a barrel Sheet.
 *
 * THE NAVIGATION CONTRACT IS UNCHANGED FROM KbSell. That section's form took an
 * address, and on submit pushed:
 *
 *     `${valuationPath()}?address=<typed>&from=<pathname>`
 *
 * `from` is not decoration: it carries the originating surface into the
 * valuation flow so the lead records WHICH page converted (2026-07-15
 * conversion audit — before it, every KbSell lead landed under one generic
 * legacy source path). Both params are built here exactly as KbSell built them,
 * in the same order, and an empty address still navigates to the bare path
 * rather than sending `address=`.
 *
 * WHY A SHEET AND NOT A LINK. PUBLIC_UI.md section 3 pattern 5 is "the working
 * surface for a step: form, filter set, comparison, plan detail." Typing an
 * address is that step. Demoting it to a ghost link would have dropped the
 * prefill, and the prefill is the reason the valuation page opens already
 * knowing the house.
 *
 * WHY THE FIGURES ARE NOT REPEATED HERE. KbSell printed a median list price and
 * a days figure above its form. Both are the same numbers the market Instrument
 * on this page already prints, under that section's own trace. Printing them a
 * second time inside a form would be a figure with no trace beside it, which is
 * the defect CLAUDE.md section 0 names. The seller's own number comes from the
 * valuation, which is what this control opens.
 *
 * Client because the answer and the navigation are visitor-caused state.
 */

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { valuationPath } from '@/lib/slug'

export function ZipSellSheet({ zip, area }: { zip: string; area: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      if (event.toStepId !== null) return
      const typed = (event.answers.address ?? '').trim()
      const params = new URLSearchParams()
      if (typed) params.set('address', typed)
      if (pathname) params.set('from', pathname)
      const qs = params.toString()
      router.push(qs ? `${valuationPath()}?${qs}` : valuationPath())
    },
    [pathname, router],
  )

  const steps: readonly V3SheetStep[] = [
    {
      id: 'address',
      label: `Which ${area} address should we price?`,
      children: [
        `A licensed principal broker writes the range from the comparable sales around a ${zip} address.`,
      ],
      field: {
        kind: 'text',
        name: 'address',
        label: 'Home address',
        autoComplete: 'street-address',
        placeholder: 'Enter your home address',
      },
      advanceLabel: 'Value my home',
    },
  ]

  return (
    <V3Sheet
      id="sell"
      eyebrow={`Sell in ${area}`}
      heading="Price your home"
      steps={steps}
      currentStepId="address"
      showProgress={false}
      showEcho={false}
      onAdvance={onAdvance}
    />
  )
}
