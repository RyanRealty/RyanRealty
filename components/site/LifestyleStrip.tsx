import Image from 'next/image'
import { Body, Container, Eyebrow, H2, Section } from '@/components/site/primitives'
import type { LifestyleImage } from '@/lib/data/media/getLifestyleImages'

/**
 * "The Central Oregon life" — a grid of approved, watermark-free active-lifestyle
 * photos (biking, skiing, fishing, hiking, climbing, trail running, …) with an
 * activity caption on each. Why people move here and stay. Renders nothing when
 * the lifestyle pool is empty so a page never shows a broken section.
 */
export function LifestyleStrip({
  images,
  eyebrow = 'Life in Central Oregon',
  title = 'The reason people move here, and stay.',
  lede = 'Bend and the high desert run on the outdoors. Trails out the back door, rivers through town, snow forty minutes up the road. This is the life a home here comes with.',
}: {
  images: LifestyleImage[]
  eyebrow?: string
  title?: string
  lede?: string
}) {
  if (!images.length) return null
  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2>{title}</H2>
        <Body size="default" tone="muted" className="mt-2 max-w-2xl">
          {lede}
        </Body>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div key={img.url} className="group relative aspect-square overflow-hidden rounded-xl">
              <Image
                src={img.url}
                alt={`${img.activity} in Central Oregon`}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
              <span className="absolute bottom-2 left-2.5 text-sm font-semibold text-white drop-shadow">
                {img.activity}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
