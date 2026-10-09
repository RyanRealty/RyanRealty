/**
 * "Track record, sourced" (id="track-record"), directly after the closings
 * rail (SEO & AEO Desk brief, 2026-10-08). The firm's all-area record in one
 * <dl>, each line a fact with its count, under a dated source line. Built by
 * aboutTrackRecord from the same record /team prints, so the two pages say one
 * number. Server-rendered; nothing here fetches or formats.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import type { AboutRecordItem } from './about-record'

export function AboutTrackRecord({
  id = 'track-record',
  heading,
  lede,
  items,
  links,
}: {
  id?: string
  heading: string
  lede: string
  items: readonly AboutRecordItem[]
  links: ReadonlyArray<{ label: string; href: string }>
}) {
  if (items.length === 0) return null
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'about-record')} aria-labelledby={`${id}-heading`}>
      <div className="about-record__head">
        <V3Eyebrow>Ryan Realty · On the record</V3Eyebrow>
        <V3Heading level={2} id={`${id}-heading`} className="about-record__heading">
          {heading}
        </V3Heading>
        <p className="about-record__lede">{lede}</p>
      </div>
      <div className="about-record__body">
        <dl className="about-record__facts">
          {items.map((item) => (
            <div key={item.term} className="about-record__fact">
              <dt>{item.term}</dt>
              <dd>
                {item.body.map((part, index) =>
                  typeof part === 'string' ? (
                    <span key={index}>{part}</span>
                  ) : (
                    <Link key={index} href={part.href}>
                      {part.label}
                    </Link>
                  ),
                )}
              </dd>
            </div>
          ))}
        </dl>
        {links.length > 0 ? (
          <p className="about-record__links">
            {links.map((link, index) => (
              <span key={link.href}>
                {index > 0 ? ' · ' : null}
                <Link href={link.href}>{link.label}</Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </section>
  )
}
