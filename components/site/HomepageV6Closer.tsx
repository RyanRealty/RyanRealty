/**
 * HomepageV6Closer — seller CTA band (v6 LOCKED, Linear finish).
 * Navy block, cream primary action into the seller valuation path,
 * dotted direct line as the ghost action.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CONTACT } from '@/lib/brand/contact'

export default function HomepageV6Closer() {
  return (
    <section className="v6-closer">
      {/* v6 LOCKED: one Amboqia moment (hero H1) — section headings stay Geist. */}
      {/* heading-display-ok */}
      <h2>Selling? See what we see.</h2>
      <div className="v6-closer-actions">
        <Button asChild className="v6-btn-primary">
          <Link href="/lp/seller-home-value">Get the reading on your home</Link>
        </Button>
        <a className="v6-btn-ghost v6-tnum" href={`tel:${CONTACT.phoneDirectTel}`}>
          {CONTACT.phoneDirect}
        </a>
      </div>
    </section>
  )
}
