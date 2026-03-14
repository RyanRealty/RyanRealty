import Link from 'next/link'

const FALLBACK_NAME = process.env.NEXT_PUBLIC_SITE_OWNER_NAME || 'Ryan Realty'
const FALLBACK_EMAIL = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL

type SiteFooterProps = {
  brokerageName?: string
  brokerageTagline?: string | null
  brokerageEmail?: string | null
}

export default function SiteFooter({ brokerageName, brokerageTagline, brokerageEmail }: SiteFooterProps = {}) {
  const currentYear = new Date().getFullYear()
  const siteName = brokerageName ?? FALLBACK_NAME
  const siteEmail = brokerageEmail ?? FALLBACK_EMAIL

  return (
    <footer className="border-t border-border bg-muted text-muted-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="text-lg font-semibold text-foreground">
              {siteName}
            </Link>
            <p className="mt-2 max-w-sm text-sm">
              {brokerageTagline?.trim() || "Central Oregon's trusted source for homes for sale. Browse listings, explore neighborhoods, and find your next home."}
            </p>
            {siteEmail && (
              <p className="mt-2 text-sm">
                <a href={`mailto:${siteEmail}`} className="hover:text-foreground">
                  {siteEmail}
                </a>
              </p>
            )}
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 sm:flex-col" aria-label="Footer">
            <Link href="/" className="text-sm hover:text-foreground">
              Home
            </Link>
            <Link href="/about" className="text-sm hover:text-foreground">
              About
            </Link>
            <Link href="/team" className="text-sm hover:text-foreground">
              Team
            </Link>
            <Link href="/listings" className="text-sm hover:text-foreground">
              Listings
            </Link>
            <Link href="/listings?view=map" className="text-sm hover:text-foreground">
              Map
            </Link>
            <Link href="/reports" className="text-sm hover:text-foreground">
              Market Reports
            </Link>
            <Link href="/tools/mortgage-calculator" className="text-sm hover:text-foreground">
              Mortgage Calculator
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-sm">
          <p className="text-muted-foreground">
            We are pledged to the letter and spirit of U.S. policy for the achievement of equal housing opportunity. Listing content is from the MLS and is deemed reliable but not guaranteed.
          </p>
          <p className="mt-2">© {currentYear} {siteName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
