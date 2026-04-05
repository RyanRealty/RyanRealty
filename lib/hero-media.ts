import { getCityHeroImage } from '@/lib/central-oregon-images'
import { getFallbackImage } from '@/lib/fallback-images'

const HOME_HERO_UNSPLASH =
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2200&q=80'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function isUnsplashImageUrl(url: string | null | undefined): boolean {
  const value = url?.trim()
  if (!value) return false
  return value.includes('images.unsplash.com')
}

export function resolveUnsplashHeroImage(
  configuredImageUrl: string | null | undefined,
  fallbackUnsplashImage: string
): string {
  if (isUnsplashImageUrl(configuredImageUrl)) return configuredImageUrl!.trim()
  return fallbackUnsplashImage
}

export function getHomeHeroImage(): string {
  return HOME_HERO_UNSPLASH
}

export function getCityHeroUnsplash(cityName: string): string {
  return getCityHeroImage(cityName)
}

export function getCommunityHeroUnsplash(cityName: string, communityName: string): string {
  return getFallbackImage('community', `${cityName}-${communityName}`)
}

export function getNeighborhoodHeroUnsplash(cityName: string, neighborhoodName: string): string {
  return getFallbackImage('community', `${cityName}-${neighborhoodName}`)
}
