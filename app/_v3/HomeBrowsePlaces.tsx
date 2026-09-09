/**
 * Browse places on Home `/`: city and resort chip doors.
 * PAGE_INVENTORY §5. Equal text chips in a multi-column grid.
 * No uneven mark thumbnails.
 *
 * TWO LABELLED RUNS, NOT TWELVE IDENTICAL BOXES (2026-09-08 evaluator). The
 * section used to be one grid of twelve chips with nothing to tell a town from
 * a resort and no data in any of them — the "identical empty boxes" TASTE.md
 * names. A town and a resort community are different kinds of place, so they
 * are different runs, each with its own name and its own index door; and a town
 * chip carries the live count of what is for sale there, which is the whole
 * reason to tap it.
 *
 * SECTION 0. `count` arrives PREFORMATTED from the caller's live read and is
 * simply absent when that read has no measured figure for a place — a chip with
 * no count is a chip with no count, never a zero, never an estimate. The run's
 * `unit` says in plain words what those figures count, once, above them, so the
 * chip can carry the bare numeral and still not be the "figure with no sentence
 * beside it" TASTE.md bans. The resort run carries neither because this page
 * holds no per-resort inventory read; those figures live on /communities.
 */
import Link from 'next/link'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import './home-browse-places.css'

export type HomePlaceDoor = {
  label: string
  href: string
  /**
   * The figure for this place, formatted by the caller: "671". What it counts is
   * the run's `unit`, printed once above the run. Omit when the read has no
   * measured figure for this place (section 0) — never send a zero for a miss.
   */
  count?: string
}

export type HomePlaceRun = {
  /** The run's name, in plain words a visitor reads. Never a slug. */
  name: string
  /**
   * What every `count` in this run counts, in plain words: "houses for sale".
   * Required whenever any door carries a count, so no numeral ships unlabelled.
   */
  unit?: string
  doors: readonly HomePlaceDoor[]
  /** The run's index door, at the end of its own row of names. */
  seeAll?: { label: string; href: string }
}

export function HomeBrowsePlaces({
  runs,
  id = 'places',
  eyebrow = 'Central Oregon',
  heading = 'Browse places',
}: {
  runs: readonly HomePlaceRun[]
  /** Bound in app/page.tsx for ci:page-purpose (id must appear in the page source). */
  id?: string
  eyebrow?: string
  heading?: string
}) {
  const shown = runs
    .map((run) => ({
      ...run,
      doors: run.doors.filter((d) => d.label.trim() && d.href.trim()),
    }))
    .filter((run) => run.name.trim() && run.doors.length > 0)
  if (shown.length === 0) return null

  return (
    <section
      id={id}
      className={`${V3_ROOT_CLASS} home-browse-places`}
      aria-labelledby="places-heading"
    >
      <div className="home-browse-places__head">
        {eyebrow.trim() ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={2} id="places-heading" className="home-browse-places__heading">
          {heading}
        </V3Heading>
      </div>

      {shown.map((run) => {
        const runId = `${id}-${run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
        return (
          <section key={runId} className="home-browse-places__run" aria-labelledby={runId}>
            <div className="home-browse-places__runhead">
              <h3 id={runId} className="home-browse-places__runname">
                {run.name}
                {run.unit?.trim() ? (
                  <span className="home-browse-places__unit"> · {run.unit}</span>
                ) : null}
              </h3>
              {run.seeAll ? (
                <Link href={run.seeAll.href} className="home-browse-places__all">
                  {run.seeAll.label}
                </Link>
              ) : null}
            </div>

            <ul className="home-browse-places__chips">
              {run.doors.map((door) => (
                <li key={door.href} className="home-browse-places__item">
                  <Link href={door.href} className="home-browse-places__chip">
                    <span className="home-browse-places__label">{door.label}</span>
                    {door.count ? (
                      <span className="home-browse-places__count">{door.count}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </section>
  )
}
