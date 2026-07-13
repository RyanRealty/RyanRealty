import '@/components/site/kb/kb.css'
import { KbNav } from '@/components/site/kb/KbNav.client'

/**
 * design-audit NAV-1: renders KbNav (solid) as the single nav for EVERY search
 * route — the index (/homes-for-sale) and the /homes-for-sale/<city> search-form
 * pages (results / map / golf branches). Rendering it here (uniformly) means no
 * search branch can ever end up with zero nav after the default SiteHeader is
 * suppressed on /homes-for-sale/** in lib/site/chrome-routes.ts.
 *
 * KbNav is position:fixed (0 flow height) and lives in a nav-only .kb-root
 * wrapper, so the reset never bleeds onto the shadcn map/filter surface. Each
 * page handles its own top clearance for the 64px fixed bar.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="kb-root">
        <KbNav solid />
      </div>
      {children}
    </>
  )
}
