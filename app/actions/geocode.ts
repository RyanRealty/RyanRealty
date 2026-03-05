'use server'
import { createClient } from '@supabase/supabase-js'

export async function getGeocodedListings(listings: any[]) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  if (!mapboxToken || !listings) return listings || []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase =
    supabaseUrl?.trim() && serviceKey?.trim()
      ? createClient(supabaseUrl, serviceKey)
      : null

  const updatedListings = await Promise.all(
    listings.map(async (item) => {
      if (item.Latitude && item.Longitude) return item

      const address = `${item.StreetNumber} ${item.StreetName}, ${item.City}, ${item.State} ${item.PostalCode}`
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}`
        )
        const data = await res.json()

        if (data.features?.length > 0) {
          const [lng, lat] = data.features[0].center
          if (supabase) {
            await supabase
              .from('listings')
              .update({ Latitude: lat, Longitude: lng })
              .eq('ListNumber', item.ListNumber)
          }
          return { ...item, Latitude: lat, Longitude: lng }
        }
      } catch (e) {
        console.error('Geocoding failed for:', address)
      }
      return item
    })
  )

  return updatedListings
}
