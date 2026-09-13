import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'
import {
  isVendorListingMediaUrl,
  listingPhotoSrcSet,
} from '@/lib/listing/row-photo'

/**
 * Listing stills and video posters that a vendor already sized (Spark, YouTube,
 * Vimeo) skip `/_next/image`. Spark resize URLs also get a native srcset of
 * the three verified buckets (320 / 800 / 1600) so a hero or feed poster is
 * never stuck on a 320 thumb. First-party / Unsplash / Supabase stay on
 * next/image.
 */
export function SparkSafeImage({
  src,
  unoptimized,
  sizes,
  alt,
  fill,
  priority,
  className,
  onError,
  ...props
}: ImageProps) {
  const url = typeof src === 'string' ? src : ''
  const vendor = unoptimized || isVendorListingMediaUrl(url)
  if (vendor && url) {
    const srcSet = listingPhotoSrcSet(url)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Spark/YouTube/Vimeo
      // already sized these plates; next/image would bill Vercel Image Optimization.
      <img
        src={url}
        srcSet={srcSet}
        sizes={typeof sizes === 'string' ? sizes : undefined}
        alt={typeof alt === 'string' ? alt : ''}
        className={fill ? cn('absolute inset-0 h-full w-full', className) : className}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={onError}
      />
    )
  }
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={onError}
      unoptimized={unoptimized}
    />
  )
}
