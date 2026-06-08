/**
 * Listing video types. The site embeds professional listing videos sourced
 * from MLS via the Spark sync — agents pay videographers (Aryeo, Riley
 * Visuals, Walker & Homes, etc.), upload to MLS, MLS feeds us, we display.
 *
 * Three-tier fallback in getListingVideos():
 *   1. Our own renders in listing_videos (rare — only the 3 listings WE list)
 *   2. video_tours_cache (nightly cron from MLS feed, 48 luxury listings today)
 *   3. listings.details.Videos JSONB (raw MLS payload)
 */

export type VideoSource =
  | 'our-render'
  | 'mls-aryeo'
  | 'mls-vimeo'
  | 'mls-youtube'
  | 'mls-cloudflare-stream'
  | 'mls-direct-mp4'
  | 'mls-matterport'
  | 'mls-walker-homes'
  | 'mls-riley-visuals'
  | 'mls-mapright'
  | 'mls-other'

export type VideoOrientation = 'portrait' | 'landscape' | 'square'

export type VideoEmbed = {
  /** Identifier for tracking which tier the video came from. */
  source: VideoSource
  /** How the page should render this video. 'link' = host blocks framing
   *  (e.g. Dropbox) so we surface a watch-link instead of a broken iframe. */
  embedType: 'iframe' | 'video-tag' | 'link'
  /** Embed src, direct video file URL, or (for 'link') the watch URL. */
  url: string
  /** Optional poster image preloaded for LCP. */
  posterUrl?: string
  /** Duration in whole seconds, when known. */
  durationSeconds?: number
  /** Display orientation hint, when known. */
  orientation?: VideoOrientation
  /** True when the video came from MLS via a paid videographer. */
  professional: boolean
  /** True when this is a 3D / interactive virtual TOUR (Matterport, Zillow-3D,
   *  Google-Drive, etc.) rather than a marketing video. The listing page shows
   *  tours in a dedicated viewer, separate from the video hero. */
  isVirtualTour?: boolean
}
