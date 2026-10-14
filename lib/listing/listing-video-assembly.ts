/**
 * A listing's videos and tours, assembled from the MLS payload. Pure and
 * client-safe; the DALs read, this shapes. Moved out of getListingVideos
 * (2026-10-14) so the listing page, the /videos tiles and /sitemaps/video.xml
 * resolve one listing's media the same way.
 *
 * Every URL goes through normalizeEmbed, which runs cleanListingMediaUrl
 * first: a mail-scanner rewrite is unwrapped and no URL carrying an email
 * address survives.
 *
 * DATES. Each MLS `Videos[]` and `VirtualTours[]` object carries its own
 * `ModificationTimestamp`: the time the listing broker's media record was last
 * written in the MLS. That is the only real date a listing video has here, so
 * it becomes VideoEmbed.uploadDate. The scalar VirtualTourURLUnbranded /
 * VirtualTourURLBranded fields and the video_tours_cache rows carry no date;
 * a video known only from them has no uploadDate, and no VideoObject is built
 * for it (publish-listing-video-schema.ts).
 *
 * THE EPOCH SENTINEL. The feed writes 1970-01-01T00:00:00Z on media records it
 * has no time for (both records on 220228245 and 220228576, 2026-10-14), so a
 * timestamp before 2000 is no date. listing_history then holds the real one:
 * the MLS logs a `Video` or `VirtualTour` event each time that kind of media
 * record is written. An event names the kind, not the record, so it dates a
 * record only when the listing has exactly ONE record of that kind; the
 * latest such event is that record's last write, the same meaning as its
 * ModificationTimestamp. Two or more records of a kind stay undated.
 */
import { toIsoTimestamp } from '@/lib/format/date'
import { normalizeEmbed, preferPlayableCopy } from '@/lib/video-embed'
import { isListingVirtualTour } from '@/lib/listing/publish-listing-hero-video'
import type { VideoEmbed, VideoSource } from '@/lib/data/types/video'

/**
 * Pull an `iframe src="..."` URL out of an MLS-supplied ObjectHtml
 * payload. The RETS Spark feed wraps the video reference in an iframe
 * HTML snippet (typical pattern: `<iframe src="https://player.vimeo.com/video/123" ...>`).
 * Returns the unescaped URL, or null if no iframe was found.
 */
function extractIframeSrc(html: string): string | null {
  const m = /<iframe[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html)
  if (!m) return null
  // Spark double-encodes ampersands inside the HTML — convert &amp; back to &
  // so the embed URL stays browser-loadable.
  return m[1].replace(/&amp;/g, '&')
}

/** Detect the video source from a URL and the MLS Source hint. */
export function classifyListingVideoSource(url: string, hintSource?: string | null): VideoSource {
  const u = url.toLowerCase()
  if (hintSource) {
    const hint = hintSource.toLowerCase()
    if (hint.includes('aryeo')) return 'mls-aryeo'
    if (hint.includes('walker')) return 'mls-walker-homes'
    if (hint.includes('riley')) return 'mls-riley-visuals'
    if (hint.includes('matterport')) return 'mls-matterport'
    if (hint.includes('cloudflare')) return 'mls-cloudflare-stream'
    if (hint.includes('mapright')) return 'mls-mapright'
  }
  if (u.includes('vimeo.com')) return 'mls-vimeo'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'mls-youtube'
  if (u.includes('cloudflarestream.com') || u.includes('videodelivery.net')) return 'mls-cloudflare-stream'
  if (u.includes('aryeo.com')) return 'mls-aryeo'
  if (u.includes('matterport.com')) return 'mls-matterport'
  if (u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov')) return 'mls-direct-mp4'
  return 'mls-other'
}

/** Rank an MLS VirtualTours entry: unbranded first (no competitor chrome),
 *  then branded, then unknown. Lower = preferred. */
function virtualTourRank(t: unknown): number {
  if (!t || typeof t !== 'object') return 3
  const type = String((t as Record<string, unknown>).Type ?? '').toLowerCase()
  if (type === 'unbranded') return 0
  if (type === 'branded') return 1
  return 2
}

/**
 * Derive a raw video URL from an MLS `details.Videos` entry. The RETS Spark feed
 * stores the reference under `ObjectHtml`, which may be an <iframe> snippet, an
 * <a> link, OR a BARE URL (Dropbox, Aryeo). The previous code only handled the
 * <iframe> case via extractIframeSrc, silently dropping ~half of listing videos
 * — including the $48.56M (Dropbox) and $21M (Aryeo) flagships.
 */
export function deriveMlsVideoRawUrl(vid: Record<string, unknown>): string | null {
  for (const f of ['MediaURL', 'VideoURL', 'Url'] as const) {
    const v = vid[f]
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
  }
  const oh = vid.ObjectHtml
  if (typeof oh === 'string') {
    const html = oh.trim()
    const iframe = extractIframeSrc(html)
    if (iframe) return iframe
    const a = /<a[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html)
    if (a) return a[1].replace(/&amp;/g, '&')
    if (/^(?:https?:)?\/\/\S+$/i.test(html)) return html.replace(/&amp;/g, '&')
  }
  return null
}

/**
 * Earliest media date taken as real. The feed writes 1970-01-01T00:00:00Z
 * (the Unix epoch) on records with no timestamp: measured on one Active
 * listing's YouTube record 2026-10-14. Nothing before 2000 is a listing video.
 */
const MLS_MEDIA_DATE_FLOOR_MS = Date.UTC(2000, 0, 1)

/**
 * The MLS record's own date, as ISO, or undefined. An epoch sentinel (or
 * anything before 2000) and a timestamp more than a day in the future are
 * feed faults, not dates to publish.
 */
export function mlsMediaUploadDate(value: unknown, now: Date = new Date()): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const iso = toIsoTimestamp(value.trim())
  if (!iso) return undefined
  const t = Date.parse(iso)
  if (t < MLS_MEDIA_DATE_FLOOR_MS) return undefined
  return t > now.getTime() + 86_400_000 ? undefined : iso
}

/** listing_history dates for a listing's media kinds (MediaHistoryDates). */
export type MediaHistoryDates = { video?: string; tour?: string }

/**
 * The latest `Video` and `VirtualTour` event dates in a listing's MLS history,
 * each passed through the same floor and future guard as a media timestamp.
 */
export function latestMediaHistoryDates(
  rows: ReadonlyArray<{ event: string | null; event_date: string | null }>,
  now: Date = new Date(),
): MediaHistoryDates {
  const out: MediaHistoryDates = {}
  for (const r of rows) {
    const kind = r.event === 'Video' ? 'video' : r.event === 'VirtualTour' ? 'tour' : null
    if (!kind) continue
    const iso = mlsMediaUploadDate(r.event_date, now)
    if (!iso) continue
    const prev = out[kind]
    if (!prev || Date.parse(iso) > Date.parse(prev)) out[kind] = iso
  }
  return out
}

/** One MLS media reference, before normalization. */
export type MlsVideoCandidate = {
  raw: string
  hint: string | null
  isVirtualTour: boolean
  /** From the tour fields (tagged true/false), not details.Videos (tagged only when a tour). */
  fromTours: boolean
  uploadDate?: string
}

/**
 * Every video and tour reference in an MLS `details` payload, in display
 * order: `Videos[]` (marketing videos), then the tours: the scalar
 * VirtualTourURLUnbranded, `VirtualTours[]` (unbranded first), the scalar
 * VirtualTourURLBranded. Matt: "listing videos and virtual tours are
 * different"; a walkthrough reel stuffed into VirtualTours is still a video.
 */
export function mlsDetailsVideoCandidates(
  details: unknown,
  now: Date = new Date(),
  history: MediaHistoryDates = {},
): MlsVideoCandidate[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return []
  const det = details as Record<string, unknown>
  const out: MlsVideoCandidate[] = []
  // A history date stands in for a sentinel only when one record of that kind exists.
  const videoRecords = Array.isArray(det.Videos) ? det.Videos.filter((v) => v && typeof v === 'object') : []
  const tourRecords = Array.isArray(det.VirtualTours) ? det.VirtualTours.filter((t) => t && typeof t === 'object') : []
  const videoHistoryDate = videoRecords.length === 1 ? history.video : undefined
  const tourHistoryDate = tourRecords.length === 1 ? history.tour : undefined

  if (Array.isArray(det.Videos)) {
    for (const v of det.Videos) {
      if (!v || typeof v !== 'object') continue
      const vid = v as Record<string, unknown>
      const raw = deriveMlsVideoRawUrl(vid)
      if (!raw) continue
      const hint = typeof vid.Source === 'string' ? vid.Source : null
      const name = typeof vid.Name === 'string' ? vid.Name : null
      out.push({
        raw,
        hint,
        isVirtualTour: isListingVirtualTour({ url: raw, name, hint }),
        fromTours: false,
        uploadDate: mlsMediaUploadDate(vid.ModificationTimestamp, now) ?? videoHistoryDate,
      })
    }
  }

  const tours: Array<{ raw: string; uploadDate?: string }> = []
  const pushTour = (v: unknown, uploadDate?: string) => {
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) tours.push({ raw: v.trim(), uploadDate })
  }
  pushTour(det.VirtualTourURLUnbranded)
  if (Array.isArray(det.VirtualTours)) {
    for (const t of [...det.VirtualTours].sort((a, b) => virtualTourRank(a) - virtualTourRank(b))) {
      if (t && typeof t === 'object') {
        const rec = t as Record<string, unknown>
        pushTour(rec.Uri, mlsMediaUploadDate(rec.ModificationTimestamp, now) ?? tourHistoryDate)
      }
    }
  }
  pushTour(det.VirtualTourURLBranded)
  for (const t of tours) {
    const isTour = isListingVirtualTour({ url: t.raw, hint: 'virtual-tour' })
    out.push({ raw: t.raw, hint: isTour ? 'virtual-tour' : null, isVirtualTour: isTour, fromTours: true, uploadDate: t.uploadDate })
  }
  return out
}

/**
 * Collects normalized embeds, de-duplicated by media IDENTITY (the embed URL
 * without query/hash), not the raw string. The MLS frequently lists the SAME
 * Vimeo/YouTube/Matterport as both a Video and a VirtualTour, and the two
 * copies often differ by a query param (the video iframe carries Vimeo's
 * privacy `?h=` hash, the tour URL does not). The first copy keeps its place
 * and tags; it takes the later copy's src only when the later one alone
 * carries the hash, and the later copy's uploadDate when it had none.
 */
export function createListingVideoCollector() {
  const out: VideoEmbed[] = []
  const seen = new Map<string, number>()
  const mediaKey = (u: string) => u.split('?')[0].split('#')[0]
  const push = (raw: string | null | undefined, hint: string | null | undefined, extra: Partial<VideoEmbed> = {}): void => {
    if (!raw) return
    const norm = normalizeEmbed(raw, hint)
    if (!norm) return
    const key = mediaKey(norm.url)
    const at = seen.get(key)
    if (at !== undefined) {
      const url = preferPlayableCopy(out[at].url, norm.url)
      const uploadDate = out[at].uploadDate ?? extra.uploadDate
      if (url !== out[at].url || uploadDate !== out[at].uploadDate) {
        out[at] = { ...out[at], url, ...(uploadDate ? { uploadDate } : {}) }
      }
      return
    }
    seen.set(key, out.length)
    const entry: VideoEmbed = {
      source: classifyListingVideoSource(norm.url, hint ?? undefined),
      embedType: norm.embedType,
      url: norm.url,
      posterUrl: norm.posterUrl,
      professional: true,
      ...extra,
    }
    if (entry.uploadDate === undefined) delete entry.uploadDate
    out.push(entry)
  }
  const pushCandidates = (candidates: readonly MlsVideoCandidate[]): void => {
    for (const c of candidates) {
      push(c.raw, c.hint, {
        ...(c.fromTours ? { isVirtualTour: c.isVirtualTour } : c.isVirtualTour ? { isVirtualTour: true } : {}),
        ...(c.uploadDate ? { uploadDate: c.uploadDate } : {}),
      })
    }
  }
  return { push, pushCandidates, list: (): VideoEmbed[] => out }
}

/** True when a record of this kind would take a history date (one record, sentinel stamp). */
export function needsMediaHistoryDate(details: unknown, now: Date = new Date()): boolean {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false
  const det = details as Record<string, unknown>
  for (const key of ['Videos', 'VirtualTours'] as const) {
    const recs = Array.isArray(det[key]) ? (det[key] as unknown[]).filter((r) => r && typeof r === 'object') : []
    if (recs.length === 1 && !mlsMediaUploadDate((recs[0] as Record<string, unknown>).ModificationTimestamp, now)) return true
  }
  return false
}

/** The MLS payload's videos and tours, normalized and de-duplicated. */
export function listingVideosFromDetails(
  details: unknown,
  now: Date = new Date(),
  history: MediaHistoryDates = {},
): VideoEmbed[] {
  const c = createListingVideoCollector()
  c.pushCandidates(mlsDetailsVideoCandidates(details, now, history))
  return c.list()
}
