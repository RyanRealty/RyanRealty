import { HeroBlock } from './HeroBlock'

/**
 * Site v2 homepage hero — locked Old Mill kenburns, headline, lede,
 * search bar, 7 city chips. Now a thin wrapper around `HeroBlock`
 * (`./HeroBlock.tsx`) which is the canonical config-driven hero. Other
 * routes import HeroBlock directly with their own headline + lede +
 * photo configuration.
 *
 * Per CLAUDE.md / SITE_SPEC: canonical brand hero is the Old Mill
 * master at public/brand/hero/hero-old-mill-master-4k.jpg (HeroBlock's
 * default).
 */

const CITY_CHIPS = [
  { label: 'Bend', href: '/cities/bend' },
  { label: 'Redmond', href: '/cities/redmond' },
  { label: 'Sisters', href: '/cities/sisters' },
  { label: 'Sunriver', href: '/cities/sunriver' },
  { label: 'Tumalo', href: '/cities/tumalo' },
  { label: 'La Pine', href: '/cities/la-pine' },
  { label: 'Prineville', href: '/cities/prineville' },
] as const

export default function Hero() {
  return (
    <HeroBlock
      headline="Find Your Home in Central Oregon"
      lede="Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Real numbers, direct from the brokers who close deals here."
      showSearch
      chips={CITY_CHIPS}
    />
  )
}
