// @no-parity — internal admin surface, no public mockup contract
//
// Site pages — P11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: getSession() → getAdminRoleForEmail() → the
// superuser-only redirect to /admin/access-denied, getBrokerageSettings() and
// the four values read off it, the /admin/media href, and all four client
// islands (SiteLogoForm, HeroMediaForm, TeamImageForm, SitePagesList) mounted
// with the same props. Each island renders its own heading, so this shell adds
// none — a SectionHead here would print the title twice.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1> title chrome is gone (the nav names the page), and
// the lead sentence became a verdict that counts the brand assets actually set
// — the only claim this shell can prove from what it reads.
import { getBrokerageSettings } from '@/app/actions/brokerage'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { VerdictLine } from '@/components/admin/v2'
import SiteLogoForm from './SiteLogoForm'
import HeroMediaForm from './HeroMediaForm'
import TeamImageForm from './TeamImageForm'
import SitePagesList from './SitePagesList'

export const dynamic = 'force-dynamic'

export default async function AdminSitePagesPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') redirect('/admin/access-denied')

  const brokerage = await getBrokerageSettings()
  const logoUrl = brokerage?.logo_url ?? null
  const heroVideoUrl = brokerage?.hero_video_url ?? null
  const heroImageUrl = brokerage?.hero_image_url ?? null
  const teamImageUrl = brokerage?.team_image_url ?? null

  // The verdict counts exactly the four values rendered below it, nothing else.
  const assets = [logoUrl, heroVideoUrl, heroImageUrl, teamImageUrl]
  const set = assets.filter(Boolean).length
  const missing = assets.length - set

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={missing === 0 ? 'ok' : 'attention'}>
          {missing === 0 ? (
            <>
              <b>Logo, hero video, hero image, and team image are all set.</b>
            </>
          ) : (
            <>
              <b>
                {missing} of the 4 brand {missing === 1 ? 'asset is' : 'assets are'} not set.
              </b>{' '}
              The forms below are where each one is set.
            </>
          )}
        </VerdictLine>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
        Every file below serves the public site. For the rest of the assets, open the{' '}
        <Link href="/admin/media" style={{ color: 'var(--a-accent)' }}>
          Media Library
        </Link>
        .
      </p>

      <SiteLogoForm initialLogoUrl={logoUrl} />

      <div style={{ marginTop: 32 }}>
        <HeroMediaForm initialHeroVideoUrl={heroVideoUrl} initialHeroImageUrl={heroImageUrl} />
      </div>

      <div style={{ marginTop: 32 }}>
        <TeamImageForm initialTeamImageUrl={teamImageUrl} />
      </div>

      <div style={{ marginTop: 32 }}>
        <SitePagesList />
      </div>
    </div>
  )
}
