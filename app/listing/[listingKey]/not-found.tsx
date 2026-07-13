import Link from 'next/link'
import { KbNav } from '@/components/site/kb/KbNav.client'
import '@/components/site/kb/kb.css'

/**
 * design-audit STA-4: the listing route hides the global SiteHeader, so a
 * notFound() on an invalid/sold/stale /listing/<key> link used to render the
 * generic app/not-found.tsx with NO chrome — a headerless, orphaned "Page not
 * found" that reads as broken. This route-level not-found carries the KB nav
 * (solid, so it's visible without a hero) and frames a missing listing as
 * sold/off-market with a clear way forward, instead of a bare 404.
 */
export default function ListingNotFound() {
  return (
    <main className="kb-root" style={{ minHeight: '100vh', background: 'var(--cream)', color: 'var(--navy)' }}>
      <KbNav solid />
      <section
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '180px 24px 140px',
          textAlign: 'center',
        }}
      >
        <p className="eyebrow" style={{ color: 'var(--navy)', opacity: 0.6, marginBottom: 16 }}>
          <span className="dot" style={{ background: 'var(--navy)' }} /> Listing unavailable
        </p>
        <h1 className="display" style={{ fontSize: 'clamp(2rem,6vw,3.4rem)', lineHeight: 1.02, margin: '0 0 18px' }}>
          This home may no longer be on the market
        </h1>
        <p style={{ fontSize: '1.05rem', lineHeight: 1.6, opacity: 0.8, margin: '0 auto 32px', maxWidth: 520 }}>
          It may have sold or been taken off the market. Here is where to look next for homes in Central Oregon.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <Link href="/homes-for-sale" className="btn">
            Browse homes for sale <span className="arr">→</span>
          </Link>
          <Link href="/housing-market" className="btn alt">
            See recent market activity <span className="arr">→</span>
          </Link>
          <Link href="/contact" className="btn alt">
            Talk to a broker <span className="arr">→</span>
          </Link>
        </div>
        <p style={{ marginTop: 40 }}>
          <Link href="/" style={{ color: 'var(--navy)', fontWeight: 600 }}>
            Go to the homepage
          </Link>
        </p>
      </section>
    </main>
  )
}
