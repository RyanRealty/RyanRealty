'use client'

/**
 * beautifului-insight on /invest — paged insights with a scrubber.
 * Source: components/motion/insight-pager. Navy/cream paint is local CSS.
 */
import { useState } from 'react'
import Link from 'next/link'
import { InsightPager } from '@/components/motion/insight-pager'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import type { InvestInsightPage } from './invest-insight'
import './invest-insight.css'

export function InvestInsight({ pages }: { pages: readonly InvestInsightPage[] }) {
  const [page, setPage] = useState(0)
  if (pages.length === 0) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null
  const sharePct = Math.max(2, Math.round(current.share * 100))

  return (
    <section
      className={`${V3_ROOT_CLASS} invest-insight`}
      aria-label="Income-property composition"
    >
      <div className="invest-insight__inner">
        <InsightPager
          className="invest-insight__pager"
          title="Type"
          pages={pages.map((p) => p.title)}
          page={safe}
          onPage={setPage}
        />
        {pages.length > 1 ? (
          <input
            className="invest-insight__scrub"
            type="range"
            min={0}
            max={pages.length - 1}
            step={1}
            value={safe}
            onChange={(event) => setPage(Number(event.target.value))}
            aria-label="Scrub income property types"
            aria-valuetext={current.title}
          />
        ) : null}
        <div className="invest-insight__face">
          <p className="invest-insight__figure tabular-nums">{current.figure}</p>
          <p className="invest-insight__share">{current.noun} · {current.shareLabel}</p>
          <div
            className="invest-insight__track"
            role="img"
            aria-label={current.shareLabel}
          >
            <span className="invest-insight__fill" style={{ width: `${sharePct}%` }} />
          </div>
          <p className="invest-insight__def">{current.definition}</p>
          {current.trades.length > 0 ? (
            <ul className="invest-insight__trades">
              {current.trades.map((bit) => (
                <li key={bit}>{bit}</li>
              ))}
            </ul>
          ) : null}
          <Link className="invest-insight__go" href={current.href}>
            {current.hrefLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}
