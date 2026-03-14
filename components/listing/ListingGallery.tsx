'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { SparkPhoto } from '../../lib/spark'
import { Button } from "@/components/ui/button"

type Props = { photos: SparkPhoto[] }

export default function ListingGallery({ photos }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!photos.length) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        No photos
      </div>
    )
  }

  const primary = photos.find((p) => p.Primary) ?? photos[0]
  const displayList = [primary, ...photos.filter((p) => p !== primary)]
  const current = displayList[selectedIndex] ?? displayList[0]
  const src = current.Uri1600 ?? current.Uri1280 ?? current.Uri1024 ?? current.Uri800 ?? current.Uri640 ?? current.UriLarge ?? current.Uri300

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="aspect-[16/10] relative bg-muted">
          <Button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Image
              src={src ?? ''}
              alt={current.Caption ?? `Photo ${selectedIndex + 1}`}
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority={selectedIndex === 0}
            />
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-border p-2">
          {displayList.map((p, i) => {
            const thumb = p.Uri300 ?? p.Uri640 ?? p.Uri800
            return (
              <Button
                key={p.Id ?? i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${
                  selectedIndex === i ? 'border-foreground' : 'border-transparent'
                }`}
              >
                <img
                  src={thumb ?? ''}
                  alt={`Photo ${i + 1} of property`}
                  width={96}
                  height={64}
                  className="h-full w-full object-cover"
                  decoding="async"
                />
              </Button>
            )
          })}
        </div>
      </div>

      {lightboxOpen && src && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxOpen(false)}
          role="button"
          tabIndex={0}
        >
          <Button
            type="button"
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
            ✕
          </Button>
          <img
            src={src}
            alt={`Property photo ${selectedIndex + 1} — full size view`}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
            width={1200}
            height={750}
            decoding="async"
          />
        </div>
      )}
    </>
  )
}
