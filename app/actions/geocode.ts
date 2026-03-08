'use server'
import { createClient } from '@supabase/supabase-js'

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function getGeocodedListings(listings: any[]) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey?.trim() || !listings) return listings || []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase =
    supabaseUrl?.trim() && serviceKey?.trim()
      ? createClient(supabaseUrl, serviceKey)
      : null

  const updatedListings = await Promise.all(
    listings.map(async (item) => {
      if (item.Latitude && item.Longitude) return item

      const address = `${item.StreetNumber ?? ''} ${item.StreetName ?? ''}, ${item.City ?? ''}, ${item.State ?? ''} ${item.PostalCode ?? ''}`.trim()
      if (!address.replace(/,/g, '').trim()) return item

      try {
        const params = new URLSearchParams({ address, key: apiKey })
        const res = await fetch(`${GEOCODE_URL}?${params.toString()}`)
        const data = await res.json()

        if (data.status === 'OK' && data.results?.length > 0) {
          const { lat, lng } = data.results[0].geometry?.location ?? {}
          if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
            if (supabase) {
              await supabase
                .from('listings')
                .update({ Latitude: lat, Longitude: lng })
                .eq('ListNumber', item.ListNumber)
            }
            return { ...item, Latitude: lat, Longitude: lng }
          }
        }
      } catch (e) {
        console.error('Geocoding failed for:', address, e)
      }
      return item
    })
  )

  return updatedListings
}
