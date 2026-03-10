import Image from 'next/image'

type Props = {
  images: { id: string; image_url: string }[]
}

export default function BrokerGallery({ images }: Props) {
  if (images.length === 0) return null

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-gallery-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="broker-gallery-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          Photos
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square overflow-hidden rounded-xl bg-[var(--gray-bg)]"
            >
              <Image
                src={img.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
