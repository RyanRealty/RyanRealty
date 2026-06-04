import Link from 'next/link'
import type { MegaMenuLearn } from '@/lib/data'
import { Tile, PanelHeading, PanelLink } from './megaShared'

/**
 * LearnBento — the Learn panel. The guide list comes from live blog posts when
 * available (each with a published date) or the static guide routes otherwise.
 * A tools column links the calculators and resources. Dates are formatted with a
 * pinned America/Los_Angeles time zone so server and client agree (no #418 risk),
 * though this is a server component anyway.
 */

const TOOL_LINKS = [
  { href: '/guides', label: 'Buyer and seller guides' },
  { href: '/resources', label: 'Resources' },
  { href: '/faq', label: 'Frequently asked questions' },
  { href: '/videos', label: 'Video library' },
  { href: '/tools/mortgage-calculator', label: 'Mortgage calculator' },
  { href: '/tools/appreciation', label: 'Appreciation tool' },
]

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
}

export function LearnBento({ data }: { data: MegaMenuLearn }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Guide / blog list */}
      <div className="lg:col-span-8">
        <PanelHeading>{data.isLive ? 'Latest from the blog' : 'Guides and resources'}</PanelHeading>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.guides.map((guide) => {
            const date = formatDate(guide.date)
            return (
              <Tile key={guide.href} className="p-4">
                <Link
                  href={guide.href}
                  className="block font-display text-sm font-semibold leading-snug tracking-[-0.01em] text-primary transition hover:text-primary/80"
                >
                  {guide.title}
                </Link>
                {date && (
                  <p className="mt-1.5 text-xs leading-[1.5] tabular-nums text-muted-foreground">
                    {date}
                  </p>
                )}
              </Tile>
            )
          })}
        </div>
      </div>

      {/* Tools column */}
      <div className="lg:col-span-4">
        <PanelHeading>Tools and answers</PanelHeading>
        <ul className="mt-2 space-y-0.5">
          {TOOL_LINKS.map((link) => (
            <li key={link.href}>
              <PanelLink href={link.href}>{link.label}</PanelLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
