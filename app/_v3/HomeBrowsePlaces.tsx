'use client'

/**
 * Browse places on Home `/`: catalog Card doors, not house chips.
 * Town Cards carry a live AnimatedNumber (beUI / Rare UI). Resort Cards
 * carry the name only — this page holds no per-resort inventory read.
 */
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { homeBriefText } from './home-competitive-brief'
import './home-browse-places.css'

export type HomePlaceDoor = {
  label: string
  href: string
  /**
   * Sourced houses-for-sale count. Number animates. Formatted string is a
   * published figure with no separate magnitude. Omit when unmeasured —
   * never send a zero for a miss.
   */
  count?: number | string
}

export type HomePlaceRun = {
  name: string
  unit?: string
  doors: readonly HomePlaceDoor[]
  seeAll?: { label: string; href: string }
}

function doorCount(count: HomePlaceDoor['count']): { n: number; label: string } | null {
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    return { n: count, label: count.toLocaleString('en-US') }
  }
  if (typeof count === 'string' && count.trim()) {
    const n = Number(count.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n > 0) return { n, label: count.trim() }
  }
  return null
}

export function HomeBrowsePlaces({
  runs,
  id = 'places',
  eyebrow = 'Central Oregon',
  heading = 'Browse places',
}: {
  runs: readonly HomePlaceRun[]
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
        <p className="home-browse-places__brief">{homeBriefText('8')}</p>
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

            <ul className="home-browse-places__cards">
              {run.doors.map((door) => {
                const live = doorCount(door.count)
                return (
                  <li key={door.href} className="home-browse-places__item">
                    <Link href={door.href} className="home-browse-places__link">
                      <Card size="sm" className="home-browse-places__card">
                        <CardHeader>
                          <CardTitle>{door.label}</CardTitle>
                          {run.unit?.trim() && live ? (
                            <CardDescription>{run.unit}</CardDescription>
                          ) : null}
                        </CardHeader>
                        {live ? (
                          <CardContent>
                            <AnimatedNumber
                              value={live.n}
                              format={(n) =>
                                Math.round(n) === Math.round(live.n)
                                  ? live.label
                                  : Math.round(n).toLocaleString('en-US')
                              }
                              startOnView
                              className="home-browse-places__count"
                            />
                          </CardContent>
                        ) : null}
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </section>
  )
}
