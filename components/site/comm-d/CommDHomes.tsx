import Link from 'next/link'
import { CONTACT } from '@/lib/brand/contact'
import { formatPriceExact } from '@/lib/format/money'
import type { KbFeaturedItem } from '@/components/site/kb/types'

export function CommDHomes({
  name,
  items,
  listingsHref,
}: {
  name: string
  items: readonly KbFeaturedItem[]
  listingsHref: string
}) {
  if (items.length === 0) return null
  const sms = `sms:${CONTACT.phoneDirectTel}?body=${encodeURIComponent(`${name} list`)}`
  return (
    <section className="comm-d-section" id="homes" aria-labelledby="comm-d-homes">
      <div className="comm-d-wrap">
        <div className="comm-d-section-head">
          <span className="comm-d-eyebrow">For sale</span>
          <h2 id="comm-d-homes" className="comm-d-display">
            Homes in {name}
          </h2>
        </div>
        <div className="comm-d-homes-grid">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="comm-d-home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.img} alt="" />
              <span className="comm-d-home-ask">Ask</span>
              <span className="comm-d-home-price">
                {item.price != null ? formatPriceExact(item.price) : 'Price not published'}
              </span>
              <span className="comm-d-home-addr">{item.address || 'Address withheld'}</span>
            </Link>
          ))}
        </div>
        <div className="comm-d-homes-actions">
          <a href={sms} className="comm-d-text-link">
            Text me the list
          </a>
          <Link href={listingsHref} className="comm-d-text-link">
            See every {name} home for sale
          </Link>
        </div>
      </div>
    </section>
  )
}
