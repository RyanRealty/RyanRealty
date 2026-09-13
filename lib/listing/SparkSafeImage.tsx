import Image, { type ImageProps } from 'next/image'
import { isSparkListingPhotoUrl } from '@/lib/listing/row-photo'

/**
 * next/image that never sends Spark/MLS listing photos through `/_next/image`.
 * Site-wide `images.unoptimized: true` already makes every next/image a
 * passthrough (Matt 2026-09-13). This wrapper stays so listing surfaces stay
 * safe if that lock is ever relaxed. An explicit `unoptimized` still wins.
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
