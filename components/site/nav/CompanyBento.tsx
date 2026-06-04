import Link from 'next/link'
import type { NavLink } from '@/lib/site-nav'
import { Tile } from './megaShared'

/**
 * CompanyBento — the Company panel. Company has no data-grounded stats, so it
 * renders its site-nav children (from lib/site-nav.ts) as a clean tile list plus
 * a contact line. Each child gets a short, hand-written blurb keyed by href so
 * the tiles read as more than a flat link list.
 */

const BLURB_BY_HREF: Record<string, string> = {
  '/team': 'The brokers you work with, by name.',
  '/about': 'How a small business like ours operates.',
  '/contact': 'Reach the team directly.',
  '/reviews': 'What past clients have to say.',
  '/join': 'Work with Ryan Realty.',
}

export function CompanyBento({ items }: { items: NavLink[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-3">
        {items.map((link) => (
          <Tile key={link.href} className="p-4">
            <Link
              href={link.href}
              className="block font-display text-base font-semibold tracking-[-0.01em] text-primary transition hover:text-primary/80"
            >
              {link.label}
            </Link>
            {BLURB_BY_HREF[link.href] && (
              <p className="mt-1.5 text-[13px] leading-[1.5] text-muted-foreground">
                {BLURB_BY_HREF[link.href]}
              </p>
            )}
          </Tile>
        ))}
      </div>

      {/* Contact tile */}
      <Tile className="flex flex-col justify-center gap-2 bg-primary lg:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground/80">
          Talk to us
        </p>
        <a
          href="tel:+15412136706"
          className="font-display text-xl leading-none tracking-[-0.01em] tabular-nums text-primary-foreground transition hover:text-primary-foreground/80"
        >
          541.213.6706
        </a>
        <Link
          href="/contact"
          className="text-[13px] text-primary-foreground/90 underline-offset-2 transition hover:underline"
        >
          Send a message
        </Link>
      </Tile>
    </div>
  )
}
