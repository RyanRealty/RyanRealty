/**
 * Streaming placeholder for /cities/<slug>. Shapes match the arriving page:
 * breadcrumb, Instrument (headline, figures, ask), Field (map plus list).
 * No text, so a skeleton cannot state anything wrong.
 */
import '@/components/site/v3/tokens.css'

const BAR = 'animate-pulse rounded'

export default function CityDetailLoading() {
  return (
    <div
      className="v3 min-h-screen"
      style={{ background: 'var(--v3-surface)' }}
      aria-hidden="true"
    >
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 sm:px-8">
        <div className={`${BAR} h-4 w-56`} style={{ background: 'var(--v3-wash)' }} />

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

        <div className={`${BAR} mt-20 h-9 w-24`} style={{ background: 'var(--v3-wash)' }} />
        <div className={`${BAR} mt-3 h-3 w-44`} style={{ background: 'var(--v3-wash)' }} />
        <div className="mt-8 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className={`${BAR} h-96 w-full`} style={{ background: 'var(--v3-ground)' }} />
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
