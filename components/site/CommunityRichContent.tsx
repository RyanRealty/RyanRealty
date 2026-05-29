// brand-voice:exempt — renders verified content authored + checked elsewhere
import { Container } from '@/components/site/primitives'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

/**
 * Renders the rich, verified community/neighborhood content (overview prose +
 * at-a-glance facts + drive times + amenities) from a resort-community config.
 *
 * Shared by the resort/master-planned community page (app/communities/[slug])
 * and the Bend neighborhood page (app/cities/[slug]/[neighborhoodSlug]). The
 * at-a-glance facts card renders only when at least one resort fact exists, so
 * neighborhoods (which carry no founded/architect/HOA) show overview + drive
 * times + amenities without an empty card. Returns null when content is null.
 *
 * Source of truth: data/resort-community-<slug>.json via getResortCommunityContent.
 * Enforced by G33 (every community/neighborhood page must be content-rich) +
 * D95/D96. Numbers carry tabular-nums.
 */
export function CommunityRichContent({
  content,
  name,
}: {
  content: ResortCommunityContent | null
  name: string
}) {
  if (!content) return null

  const hasFacts = Boolean(
    content.founded ||
      content.acres ||
      content.architect ||
      content.hoaMasterAnnual ||
      content.courseRankings[0],
  )

  return (
    <>
      <section className="border-t border-border bg-background py-10 md:py-14">
        <Container>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Overview
          </p>
          <div
            className={
              hasFacts
                ? 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]'
                : 'max-w-2xl'
            }
          >
            <div className="max-w-2xl space-y-4">
              {content.aboutProse.map((para, i) => (
                <p key={i} className="text-base leading-relaxed text-foreground">
                  {para}
                </p>
              ))}
            </div>

            {hasFacts ? (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-4">At a glance</p>
                <dl className="space-y-3 text-sm">
                  {content.founded ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Founded</dt>
                      <dd className="font-medium text-foreground tabular-nums">{content.founded}</dd>
                    </div>
                  ) : null}
                  {content.acres ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {content.acres.toLocaleString()} acres
                      </dd>
                    </div>
                  ) : null}
                  {content.architect ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Architect</dt>
                      <dd className="font-medium text-foreground text-right">{content.architect}</dd>
                    </div>
                  ) : null}
                  {content.hoaMasterAnnual ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Master HOA</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        ${content.hoaMasterAnnual.toLocaleString()}/year
                      </dd>
                    </div>
                  ) : null}
                  {content.courseRankings[0] ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Recognition</dt>
                      <dd className="font-medium text-foreground text-right">
                        {content.courseRankings[0].rank} {content.courseRankings[0].publication}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>

          {content.driveTimes.length > 0 ? (
            <div className="mt-10">
              <h3 className="text-base font-semibold text-foreground mb-4">Drive times</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {content.driveTimes.map((d) => (
                  <div key={d.destination} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{d.minutes} min</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{d.destination}</div>
                    {d.note ? <div className="mt-0.5 text-xs text-muted-foreground">{d.note}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Container>
      </section>

      {content.amenities.length > 0 ? (
        <section className="border-t border-border bg-secondary/40 py-10 md:py-14">
          <Container>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Amenities and lifestyle in {name}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {content.amenities.map((a, i) => (
                <div key={`${a.name}-${i}`} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    {a.category}
                  </p>
                  <p className="text-base font-semibold text-foreground">{a.name}</p>
                  {a.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                  ) : null}
                  {a.access ? <p className="mt-3 text-xs text-muted-foreground">{a.access}</p> : null}
                </div>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  )
}
