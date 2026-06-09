'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/tracking'
import { H3 } from '@/components/site/primitives'

type Video = { Id?: string; Uri?: string; Name?: string }
type VirtualTour = { Id?: string; Uri?: string; Name?: string }

type Props = {
  listingKey: string
  videos: Video[]
  virtualTours: VirtualTour[]
  heroVideoUrl: string | null
}

export default function ShowcaseVideos({ listingKey, videos, virtualTours, heroVideoUrl }: Props) {
  const otherVideos = heroVideoUrl ? videos.filter((v) => (v.Uri ?? '') !== heroVideoUrl) : videos
  const hasOtherVideos = otherVideos.length > 0
  const hasTours = virtualTours.length > 0
  if (!hasOtherVideos && !hasTours) return null

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <H3 as="h2" className="text-lg text-foreground">Videos & virtual tours</H3>
        <div className="mt-4 flex flex-wrap gap-3">
          {otherVideos.map((v) => (
            <Button
              key={v.Id ?? v.Uri}
              asChild
              variant="outline"
              size="default"
              className="rounded-lg"
              onClick={() => trackEvent('play_video', { listing_key: listingKey, position: 'section' })}
            >
              <a href={v.Uri ?? '#'} target="_blank" rel="noopener noreferrer">
                {v.Name ?? 'Video'}
              </a>
            </Button>
          ))}
          {virtualTours.map((vt) => (
            <Button
              key={vt.Id ?? vt.Uri}
              asChild
              variant="outline"
              size="default"
              className="rounded-lg"
            >
              <Link
                href={vt.Uri ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('play_video', { listing_key: listingKey, position: 'virtual_tour' })}
              >
                Virtual tour
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
