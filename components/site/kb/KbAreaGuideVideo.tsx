/**
 * KbAreaGuideVideo — the per-location "Watch the <Location> area guide" slot.
 *
 * Serves the approved area-guide marketing cut for a geo (via getAreaGuideVideo,
 * resolved on the page). These clips carry voiceover + on-screen text, so this is
 * a CLICK-TO-PLAY player (native controls, with sound), NOT a silent looping hero.
 * Renders nothing when the location has no guide video — the caller passes null.
 *
 * Server component (native <video controls>), so it works without client JS.
 */

export function KbAreaGuideVideo({
  videoUrl,
  locationName,
  posterSrc,
}: {
  videoUrl: string | null
  locationName: string
  posterSrc?: string | null
}) {
  if (!videoUrl) return null
  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow sec-index">▸ Area guide</span>
          <h2 className="sec-title display">Watch {locationName}</h2>
        </div>
        <div
          style={{
            border: '3px solid var(--navy)',
            background: 'var(--navy)',
            marginTop: 'clamp(18px,2.4vw,28px)',
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            controls
            preload="metadata"
            playsInline
            poster={posterSrc ?? undefined}
            aria-label={`${locationName} area guide video`}
            style={{ width: '100%', display: 'block', aspectRatio: '16 / 9', objectFit: 'contain' }}
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        </div>
        <p className="mono-lab" style={{ marginTop: 10, color: 'var(--navy-70)' }}>
          A short tour of {locationName}, Central Oregon.
        </p>
      </div>
    </section>
  )
}
