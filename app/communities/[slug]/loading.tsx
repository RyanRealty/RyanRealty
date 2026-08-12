/**
 * The streaming placeholder for /communities/<slug>, and it mirrors THE PAGE THAT
 * FOLLOWS IT.
 *
 * It used to render the KB shell: a full-bleed navy root, a 70vh hero band, a
 * four-up stat row, and a featured grid. Every one of those is gone — KbHero and
 * KbFeatured are in design_system/ryan-realty/ui_kits/community/parity.json's
 * removedComponents, and the page is a cream v3 surface that opens on an Instrument
 * with no hero at all. Left as it was, every navigation to a community page flashed
 * a full-screen navy skeleton promising sections the arriving page does not have,
 * which is a user-facing claim outrunning its payload with a 300ms lifetime.
 *
 * So the shapes here are the shapes above the fold at 390: the breadcrumb trail, the
 * headline, the hairline, the figure row, the source line, the one filled ask, and
 * the start of the Field. No text, because a skeleton that states nothing cannot
 * state anything wrong.
 *
 * The tokens are the barrel's own, scoped to .v3 (components/site/v3/tokens.css is
 * declared on the class, never :root), so this file declares no color of its own and
 * cannot drift from the surface it stands in for.
 */
import '@/components/site/v3/tokens.css'

const BAR = 'animate-pulse rounded'

export default function CommunityDetailLoading() {
  return (
    <div
      className="v3 min-h-screen"
      style={{ background: 'var(--v3-surface)' }}
      aria-hidden="true"
    >
      <div className="mx-auto w-full max-w-[76rem] px-5 pb-16 pt-8 sm:px-8">
        {/* Breadcrumb trail */}
        <div className={`${BAR} h-4 w-56`} style={{ background: 'var(--v3-wash)' }} />

        {/* Instrument: eyebrow, headline, hairline, figures, source, ask */}
        <div className={`${BAR} mt-12 h-3 w-32`} style={{ background: 'var(--v3-wash)' }} />
        <div className={`${BAR} mt-6 h-12 w-11/12 sm:h-16`} style={{ background: 'var(--v3-wash)' }} />
        <div className={`${BAR} mt-3 h-12 w-3/5 sm:h-16`} style={{ background: 'var(--v3-wash)' }} />
        <div className="mt-10 h-px w-full" style={{ background: 'var(--v3-edge)' }} />
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className={`${BAR} h-9 w-28`} style={{ background: 'var(--v3-wash)' }} />
              <div className={`${BAR} mt-3 h-3 w-36`} style={{ background: 'var(--v3-wash)' }} />
            </div>
          ))}
        </div>
        <div className={`${BAR} mt-10 h-3 w-full max-w-2xl`} style={{ background: 'var(--v3-wash)' }} />
        <div className={`${BAR} mt-2 h-3 w-4/5 max-w-xl`} style={{ background: 'var(--v3-wash)' }} />
        <div className={`${BAR} mt-8 h-11 w-56 rounded-full`} style={{ background: 'var(--v3-wash)' }} />

        {/* Field: the count, then the map and the list in one frame */}
        <div className={`${BAR} mt-20 h-9 w-24`} style={{ background: 'var(--v3-wash)' }} />
        <div className={`${BAR} mt-3 h-3 w-44`} style={{ background: 'var(--v3-wash)' }} />
        <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className={`${BAR} h-[420px] w-full`} style={{ background: 'var(--v3-ground)' }} />
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${BAR} h-20 w-full`} style={{ background: 'var(--v3-wash)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
