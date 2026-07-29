import { NotFoundClient } from '@/components/NotFoundClient'
import { HideChrome } from '@/components/layout/HideOnLP'
import SiteFooter from '@/components/site/SiteFooter'

export default function NotFound() {
  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <NotFoundClient />
      </div>
      {/* 404s render at any pathname, so the footer keeps the old route-aware CSS
          gate here: visible on default-chrome paths, hidden on KB/LP/admin paths.
          This is the ONE surface that still ships the footer behind HideChrome —
          acceptable because 404 responses are never indexed. Every real page
          renders its footer server-side per scripts/check-default-chrome-footer.mjs. */}
      <HideChrome>
        <SiteFooter />
      </HideChrome>
    </>
  )
}
