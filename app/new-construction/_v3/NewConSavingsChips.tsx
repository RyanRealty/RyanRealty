import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import {
  BEND_NEW_CON_FINANCING_SOURCE,
  BEND_NEW_CON_SAVINGS_CHIPS,
  BEND_NEW_CON_STATUS_LEGEND,
  bendNewConChipFlags,
  bendNewConChipHref,
} from '@/lib/site/bend-new-construction'

export function NewConSavingsChips() {
  return (
    <section
      id="savings"
      className={cn(V3_ROOT_CLASS, 'newcon-savings')}
      aria-labelledby="savings-heading"
    >
      <div className="newcon-savings__head">
        <V3Eyebrow>Published programs</V3Eyebrow>
        <V3Heading level={2} id="savings-heading">
          Builder savings at a glance
        </V3Heading>
        <p className="newcon-savings__note">
          Chips open the builder card we already transcribed. No invented dollars.
          Flags travel with the card they belong to.
        </p>
      </div>
      <ul className="newcon-savings__chips">
        {BEND_NEW_CON_SAVINGS_CHIPS.map((chip) => {
          const flags = bendNewConChipFlags(chip)
          return (
            <li key={chip.id}>
              <a className="newcon-savings__chip" href={bendNewConChipHref(chip)}>
                <span className="newcon-savings__chip-label">{chip.label}</span>
                {flags.length > 0 ? (
                  <span className="newcon-savings__chip-flags">{flags.join(' · ')}</span>
                ) : null}
                <span className="newcon-savings__chip-scan">{chip.scan}</span>
              </a>
            </li>
          )
        })}
      </ul>
      <ul className="newcon-savings__legend" aria-label="Status legend">
        {BEND_NEW_CON_STATUS_LEGEND.map((row) => (
          <li key={row.flag}>
            <a className="newcon-savings__legend-chip" href="#faq-status-flags">
              <span className="newcon-savings__legend-flag">{row.flag}</span>
              <span className="newcon-savings__legend-meaning">{row.meaning}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="newcon-savings__source">{BEND_NEW_CON_FINANCING_SOURCE}</p>
    </section>
  )
}
