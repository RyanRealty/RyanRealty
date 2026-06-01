// brand-voice:exempt — renders verified content authored + checked elsewhere
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/site/primitives'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type { AmenityBlogPost } from '@/lib/data'

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
  postsBySlug = {},
}: {
  content: ResortCommunityContent | null
  name: string
  /**
   * Map of blog_slug -> published post metadata, resolved by the page server
   * component. Amenities with a matching entry are rendered as a link card
   * with the post's hero image. Amenities without a match render as today.
   */
  postsBySlug?: Record<string, AmenityBlogPost>
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
              {content.amenities.map((a, i) => {
                const post = a.blog_slug ? postsBySlug[a.blog_slug] : undefined
                if (post) {
                  // Amenity has a published blog post: render as a link card
                  // with the post's hero image and a "Read more" affordance.
                  return (
                    <Link
                      key={`${a.name}-${i}`}
                      href={`/blog/${post.slug}`}
                      className="group rounded-xl border border-border bg-card shadow-sm overflow-hidden hover:border-primary/40 hover:shadow-md transition-shadow"
                    >
                      {post.heroImageUrl ? (
                        <div className="relative h-40 w-full bg-secondary">
                          <Image
                            src={post.heroImageUrl}
                            alt={`${a.name} in ${name}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        </div>
                      ) : null}
                      <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                          {a.category}
                        </p>
                        <p className="text-base font-semibold text-foreground">{a.name}</p>
                        {a.description ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                        ) : null}
                        {a.access ? <p className="mt-3 text-xs text-muted-foreground">{a.access}</p> : null}
                        <p className="mt-3 text-xs font-medium text-primary group-hover:underline underline-offset-2">
                          Read more
                        </p>
                      </div>
                    </Link>
                  )
                }
                // No published post: render the current static amenity card unchanged.
                return (
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
                )
              })}
            </div>
          </Container>
        </section>
      ) : null}

      {content.courseSpecs || content.signatureHole || content.courseRankings.length > 0 ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <h2 className="text-2xl font-bold text-foreground mb-6">Golf at {name}</h2>

            {content.courseSpecs ? (
              <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {content.courseSpecs.par ? (
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{content.courseSpecs.par}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Par</div>
                  </div>
                ) : null}
                {content.courseSpecs.yardage ? (
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-2xl font-bold text-foreground tabular-nums">
                      {content.courseSpecs.yardage.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Yards</div>
                  </div>
                ) : null}
                {content.courseSpecs.rating ? (
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{content.courseSpecs.rating}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Rating</div>
                  </div>
                ) : null}
                {content.courseSpecs.slope ? (
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-2xl font-bold text-foreground tabular-nums">{content.courseSpecs.slope}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Slope</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {content.courseSpecs?.summary ? (
              <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {content.courseSpecs.summary}
              </p>
            ) : null}

            {content.signatureHole?.description ? (
              <div className="mb-8 rounded-2xl border border-border bg-secondary/40 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Signature hole</p>
                <p className="text-base font-semibold text-foreground tabular-nums">
                  Hole {content.signatureHole.number}
                  {content.signatureHole.par ? `, par ${content.signatureHole.par}` : ''}
                  {content.signatureHole.yardage ? `, ${content.signatureHole.yardage} yards` : ''}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground">
                  {content.signatureHole.description}
                </p>
              </div>
            ) : null}

            {content.courseRankings.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {content.courseRankings.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="text-xl font-bold text-foreground tabular-nums">{r.rank}</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{r.publication}</div>
                    {r.description ? (
                      <div className="mt-1 text-xs text-muted-foreground">{r.description}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}

      {content.membershipTiers.length > 0 ? (
        <section className="border-t border-border bg-secondary/40 py-10 md:py-14">
          <Container>
            <h2 className="text-2xl font-bold text-foreground mb-6">Membership at {name}</h2>
            <div className="grid gap-5 lg:grid-cols-3">
              {content.membershipTiers.map((t, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  {t.eyebrow ? (
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">{t.eyebrow}</p>
                  ) : null}
                  <p className="text-base font-semibold text-foreground">{t.name ?? t.label ?? t.tier}</p>
                  {t.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
                  ) : null}
                  {Array.isArray(t.details) && t.details.length > 0 ? (
                    <dl className="mt-4 space-y-1.5 text-sm">
                      {t.details.map((d, j) => (
                        <div key={j} className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">{d.label}</dt>
                          <dd className="font-medium text-foreground text-right">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {t.waitlist_status ? (
                    <p className="mt-3 text-xs text-muted-foreground">{t.waitlist_status}</p>
                  ) : null}
                </div>
              ))}
            </div>
            {content.membershipOfficePhone ? (
              <p className="mt-5 text-sm text-muted-foreground tabular-nums">
                Membership office: {content.membershipOfficePhone}
              </p>
            ) : null}
          </Container>
        </section>
      ) : null}

      {content.builders.length > 0 ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <h2 className="text-2xl font-bold text-foreground mb-6">Builders in {name}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {content.builders.map((b, i) => (
                <div key={`${b.name}-${i}`} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-base font-semibold text-foreground">{b.name}</p>
                  {b.role ? <p className="mt-0.5 text-xs text-muted-foreground">{b.role}</p> : null}
                  {b.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.description}</p>
                  ) : null}
                  {b.website ? (
                    <a
                      href={b.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Visit website
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  )
}
