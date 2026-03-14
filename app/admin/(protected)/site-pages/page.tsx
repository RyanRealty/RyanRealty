import { getBrokerageSettings } from '@/app/actions/brokerage'
import SiteLogoForm from './SiteLogoForm'
import HeroMediaForm from './HeroMediaForm'
import SitePagesList from './SitePagesList'

export const dynamic = 'force-dynamic'

export default async function AdminSitePagesPage() {
  const brokerage = await getBrokerageSettings()
  const logoUrl = brokerage?.logo_url ?? null
  const heroVideoUrl = brokerage?.hero_video_url ?? null
  const heroImageUrl = brokerage?.hero_image_url ?? null

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Site pages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Logo, branding, hero media, and editable content for public pages.
      </p>

      <div className="mt-8">
        <SiteLogoForm initialLogoUrl={logoUrl} />
      </div>

      <div className="mt-10">
        <HeroMediaForm initialHeroVideoUrl={heroVideoUrl} initialHeroImageUrl={heroImageUrl} />
      </div>

      <div className="mt-10">
        <SitePagesList />
      </div>
    </main>
  )
}
