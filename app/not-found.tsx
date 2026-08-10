import { NotFoundClient } from '@/components/NotFoundClient'
import { HideChrome } from '@/components/layout/HideOnLP'
import SiteFooter from '@/components/site/SiteFooter'

export default function NotFound() {
  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <NotFoundClient />
      </div>
      {/* 404s render at any pathname. HideChrome still gates SiteFooter visibility
          (KB/LP/admin hide). This is the ONE surface that still ships a footer
          behind HideChrome — 404s are never indexed. Real pages render footer
          server-side (scripts/check-default-chrome-footer.mjs). Public nav is
          PublicNav in root layout; do not re-mount KbNav here. */}
      <HideChrome>
        <SiteFooter />
      </HideChrome>
    </>
  )
}
