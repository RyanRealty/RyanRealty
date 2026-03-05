import Link from 'next/link'

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_OWNER_NAME || 'Ryan Realty'
const SITE_EMAIL = process.env.NEXT_PUBLIC_SITE_OWNER_EMAIL

export default function SiteFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 text-zinc-600">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="text-lg font-semibold text-zinc-900">
              {SITE_NAME}
            </Link>
            <p className="mt-2 max-w-sm text-sm">
              Central Oregon&apos;s trusted source for homes for sale. Browse listings, explore neighborhoods, and find your next home.
            </p>
            {SITE_EMAIL && (
              <p className="mt-2 text-sm">
                <a href={`mailto:${SITE_EMAIL}`} className="hover:text-zinc-900">
                  {SITE_EMAIL}
                </a>
              </p>
            )}
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 sm:flex-col" aria-label="Footer">
            <Link href="/" className="text-sm hover:text-zinc-900">
              Home
            </Link>
            <Link href="/listings" className="text-sm hover:text-zinc-900">
              All Listings
            </Link>
            <Link href="/listings?view=map" className="text-sm hover:text-zinc-900">
              Map View
            </Link>
            <Link href="/reports" className="text-sm hover:text-zinc-900">
              Market Reports
            </Link>
            <Link href="/tools/mortgage-calculator" className="text-sm hover:text-zinc-900">
              Mortgage Calculator
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-zinc-200 pt-6 text-center text-sm">
          © {currentYear} {SITE_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
