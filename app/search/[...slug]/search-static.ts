/**
 * Build-time helpers for /search/[...slug] (W3.5).
 *
 * Kept out of page.tsx so the route file stays inside the file-size budget
 * while still exporting a real (non-empty) generateStaticParams.
 */
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'

/**
 * True during `next build` static generation. The search page's eager fan-out
 * OOMs the build worker when generateStaticParams pre-renders even 10 bare-city
 * paths. Thin the fan-out in that phase; runtime / ISR keep the full path.
 */
export const IS_PRODUCTION_BUILD = process.env.NEXT_PHASE === 'phase-production-build'

/**
 * Pre-render the 10 SITE_CITY_SLUGS bare-city routes. The full
 * {city}/{area}/{preset} matrix is thousands of paths — on-demand via
 * dynamicParams + ISR. Empty stub banned by ci:static-params.
 */
export async function generateStaticParams(): Promise<Array<{ slug: string[] }>> {
  return SITE_CITY_SLUGS.map((city) => ({ slug: [city] }))
}
