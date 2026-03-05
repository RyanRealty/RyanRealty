'use server'

import { getBrowseCities } from './listings'
import { getSubdivisionsInCity } from './listings'
import { getSubdivisionTabContent } from './subdivision-descriptions'
import { generateSubdivisionDescription, generateSubdivisionAttractions } from './subdivision-descriptions'
import { subdivisionEntityKey } from '../../lib/slug'

/**
 * Refresh about and attractions content for communities that are missing it.
 * Call from cron (e.g. weekly). Processes up to maxSubdivisions (default 20) per run to avoid timeouts.
 */
export async function refreshPlaceContent(options: {
  maxSubdivisions?: number
}): Promise<{ updated: number; failed: number; errors: string[] }> {
  const max = options.maxSubdivisions ?? 20
  const errors: string[] = []
  let updated = 0
  let failed = 0

  const cities = await getBrowseCities()
  const processed: string[] = []

  for (const { City } of cities) {
    const subs = await getSubdivisionsInCity(City)
    for (const { subdivisionName } of subs) {
      if (processed.length >= max) break
      const key = subdivisionEntityKey(City, subdivisionName)
      if (processed.includes(key)) continue
      processed.push(key)

      const content = await getSubdivisionTabContent(City, subdivisionName)
      try {
        if (!content.about?.trim()) {
          const r = await generateSubdivisionDescription(City, subdivisionName)
          if (r.ok) updated++
          else {
            failed++
            errors.push(`${key} about: ${r.error}`)
          }
        }
        if (!content.attractions?.trim()) {
          const r = await generateSubdivisionAttractions(City, subdivisionName)
          if (r.ok) updated++
          else {
            failed++
            errors.push(`${key} attractions: ${r.error}`)
          }
        }
      } catch (e) {
        failed++
        errors.push(`${key}: ${e instanceof Error ? e.message : 'Unknown'}`)
      }
    }
    if (processed.length >= max) break
  }

  return { updated, failed, errors }
}
