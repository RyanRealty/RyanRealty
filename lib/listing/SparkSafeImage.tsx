import Image, { type ImageProps } from 'next/image'
import { isSparkListingPhotoUrl } from '@/lib/listing/row-photo'

/**
 * next/image that never sends Spark/MLS listing photos through `/_next/image`.
 * Spark CDN already resized those plates. First-party, Unsplash, and Supabase
 * srcs stay optimized. An explicit `unoptimized` still wins.
 */
export function SparkSafeImage({ src, unoptimized, ...props }: ImageProps) {
  const url = typeof src === 'string' ? src : ''
  return (
    <Image
      {...props}
      src={src}
      unoptimized={unoptimized || isSparkListingPhotoUrl(url)}
    />
  )
}
