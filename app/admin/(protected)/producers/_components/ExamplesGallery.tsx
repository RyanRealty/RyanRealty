'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ExamplesGalleryProps {
  exampleOutputs: string[]
  producerName: string
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|avi)$/i.test(url)
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(url)
}

const PLACEHOLDER = '/admin/producers/_placeholder.png'

export function ExamplesGallery({ exampleOutputs, producerName }: ExamplesGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const items = exampleOutputs.length > 0 ? exampleOutputs : [PLACEHOLDER]

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((src, i) => (
          <Card
            key={i}
            className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
            onClick={() => setSelected(src)}
          >
            <CardContent className="p-0">
              {isVideoUrl(src) ? (
                <video
                  src={src}
                  muted
                  playsInline
                  className="aspect-video w-full object-cover"
                  preload="metadata"
                />
              ) : (
                <div className="relative aspect-video w-full bg-muted">
                  <Image
                    src={src.startsWith('http') || src.startsWith('/') ? src : PLACEHOLDER}
                    alt={`${producerName} example ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized={src.startsWith('http')}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="text-sm text-muted-foreground">
              {producerName} example
            </DialogTitle>
            {isVideoUrl(selected) ? (
              <video src={selected} controls className="w-full rounded" />
            ) : (
              <div className="relative aspect-video w-full">
                <Image
                  src={selected.startsWith('http') || selected.startsWith('/') ? selected : PLACEHOLDER}
                  alt={`${producerName} example`}
                  fill
                  className="rounded object-contain"
                  unoptimized={selected.startsWith('http')}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
