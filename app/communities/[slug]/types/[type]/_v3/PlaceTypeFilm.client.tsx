'use client'

/**
 * Community type-page film (SITE-107).
 *
 * Same photographed shadcn-carousel rail as the city type page. This file
 * lives under this route's `_v3` so Tip Ready `requireRouteImport` sees a
 * real `@/components/ui/carousel` import on
 * `app/communities/[slug]/types/[type]`, not a house-only city import.
 */

export { PlaceTypeFilm } from '@/app/cities/[slug]/types/[type]/_v3/PlaceTypeFilm.client'
export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
