// brand-voice:exempt — renders verified content authored + checked elsewhere
// (data/resort-community-<slug>.json), the same source the resort landing pages use.
import Image from 'next/image'
import Link from 'next/link'
import { slugify } from '@/lib/slug'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type { AmenityBlogPost } from '@/lib/data'

// The MLS SubdivisionName field is fixed-length and cuts some names off
// mid-word ("Lodges at Bachelor V", "Triple") — they read as broken chips,
// not intentionally short ones (design-audit P3). Display-only correction;
// the raw MLS string still drives the /subdivisions/[slug] URL below since
// that page filters listings by the exact subdivision_name value. Only
// "Triple" is mapped — its full name is independently confirmed elsewhere
// in data/resort-community-tetherow.json ("Triple Knot townhomes", "$8,244
// in Triple Knot"); "Lodges at Bachelor V" has no verifiable full form in
// any source this codebase has access to, so it stays unmapped rather than
// guessed (CLAUDE.md §0 — never fabricate a value that can't be verified).
const SUBDIVISION_ALIAS_DISPLAY: Record<string, string> = {
  Triple: 'Triple Knot',
}

/**
 * KB Resort Overview — the rich, verified depth a resort/golf/master-planned
 * community page carries (overview prose + at-a-glance facts + drive times +
 * amenities + golf course + membership + builders), rendered in the kinetic-
 * brutalist register (navy surface, cream edges, Amboqia display titles, mono
 * labels, hard 1px rules — no rounded cards). It is the KB rebuild of the prior
 * CommunityRichContent so the community page keeps the LP's depth (owner directive:
 * "every resort/golf/planned community needs an overview section… amenities").
 *
 * Each block is its own `<section id>` so KbSectionTracker fires section_view, and
 * each renders ONLY when its data exists — a community with no config renders
 * nothing (the page degrades gracefully). Every fact is from the config; numbers
 * carry tabular-nums. Returns null when content is null. (§0)
 */
export function KbResortOverview({
  content,
  name,
  postsBySlug = {},
  aliases = [],
}: {
  content: ResortCommunityContent | null
  name: string
  postsBySlug?: Record<string, AmenityBlogPost>
  /** Registry subdivision_aliases — the MLS subdivision names that make up the
   *  resort. Shown as a transparency block (also explains the alias-aware count
   *  and helps buyers who searched an alias name land here). Hidden for single-
   *  name communities (a resort whose only alias is its own label). */
  aliases?: string[]
}) {
  if (!content) return null
  // Drop the resort's own name from the alias chips; show only the constituent
  // subdivisions (a single-name community then shows none). Raw MLS strings —
  // NOT display-corrected here, because slugify(a) below must match the same
  // raw subdivision_name the destination /subdivisions/[slug] page filters
  // listings by; only the visible TEXT gets the display-name correction.
  const aliasChips = aliases.filter((a) => a.toLowerCase().trim() !== name.toLowerCase().trim())

  const facts: { label: string; value: string }[] = [
    ...(content.founded ? [{ label: 'Founded', value: String(content.founded) }] : []),
    ...(content.acres ? [{ label: 'Size', value: `${content.acres.toLocaleString('en-US')} acres` }] : []),
    ...(content.architect ? [{ label: 'Architect', value: content.architect }] : []),
    ...(content.hoaMasterAnnual
      ? [{ label: 'Master HOA', value: `$${content.hoaMasterAnnual.toLocaleString('en-US')}/yr` }]
      : []),
    ...(content.courseRankings[0]
      ? [{ label: 'Recognition', value: `${content.courseRankings[0].rank} ${content.courseRankings[0].publication}` }]
      : []),
  ]
  const specs = content.courseSpecs
  const hasGolf = Boolean(specs?.par || specs?.yardage || content.signatureHole?.description || content.courseRankings.length)

  return (
    <>
      {/* ── OVERVIEW · prose + at-a-glance + drive times ── */}
      {content.aboutProse.length > 0 || facts.length > 0 || content.driveTimes.length > 0 ? (
        <section className="section ov" id="overview">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">{name} · Overview</span>
              <h2 className="sec-title display">Inside {name}</h2>
            </div>
            <div className={facts.length > 0 ? 'ov-grid' : ''}>
              <div className="ov-prose">
                {content.aboutProse.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              {facts.length > 0 ? (
                <aside className="ov-facts">
                  <span className="ov-facts-lbl mono-lab">At a glance</span>
                  <dl>
                    {facts.map((f) => (
                      <div key={f.label} className="ov-fact">
                        <dt>{f.label}</dt>
                        <dd className="mono-num">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              ) : null}
            </div>

            {content.driveTimes.length > 0 ? (
              <div className="ov-drives">
                <span className="ov-sub mono-lab">Drive times</span>
                <div className="ov-drive-row">
                  {content.driveTimes.map((d) => (
                    <div key={d.destination} className="ov-drive">
                      <span className="ov-drive-min display mono-num">{d.minutes}</span>
                      <span className="ov-drive-unit">min</span>
                      <span className="ov-drive-dest">{d.destination}</span>
                      {d.note ? <span className="ov-drive-note">{d.note}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {aliasChips.length > 0 ? (
              <div className="ov-aliases">
                <span className="ov-sub mono-lab">Subdivisions in {name}</span>
                <div className="ov-alias-row">
                  {aliasChips.map((a) => (
                    <Link key={a} href={`/subdivisions/${slugify(a)}`} className="ov-alias ov-alias-link">
                      {SUBDIVISION_ALIAS_DISPLAY[a] ?? a}
                      <span className="ov-alias-arr" aria-hidden="true">›</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── AMENITIES · the lifestyle ── */}
      {content.amenities.length > 0 ? (
        <section className="section ov-amen" id="amenities">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">{name} · Lifestyle</span>
              <h2 className="sec-title display">Amenities</h2>
            </div>
            <div className="amen-grid">
              {content.amenities.map((a, i) => {
                const post = a.blog_slug ? postsBySlug[a.blog_slug] : undefined
                const inner = (
                  <>
                    {post?.heroImageUrl ? (
                      <div className="amen-media">
                        <Image
                          src={post.heroImageUrl}
                          alt={`${a.name} in ${name}`}
                          fill
                          className="amen-img"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    ) : null}
                    <div className="amen-body">
                      <span className="amen-cat mono-lab">{a.category}</span>
                      <span className="amen-name">{a.name}</span>
                      {a.description ? <p className="amen-desc">{a.description}</p> : null}
                      {a.access ? <span className="amen-access">{a.access}</span> : null}
                      {post ? (
                        <span className="amen-read">
                          Read more <span className="arr">&rarr;</span>
                        </span>
                      ) : null}
                    </div>
                  </>
                )
                return post ? (
                  <Link key={`${a.name}-${i}`} href={`/blog/${post.slug}`} className="amen-card amen-link">
                    {inner}
                  </Link>
                ) : (
                  <div key={`${a.name}-${i}`} className="amen-card">
                    {inner}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── GOLF · course specs + signature hole + rankings ── */}
      {hasGolf ? (
        <section className="section ov" id="golf">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">{name} · Golf</span>
              <h2 className="sec-title display">The course</h2>
            </div>
            {specs && (specs.par || specs.yardage || specs.rating || specs.slope) ? (
              <div className="ov-kpis">
                {specs.par ? (
                  <div className="ov-kpi">
                    <span className="ov-kpi-val display mono-num">{specs.par}</span>
                    <span className="ov-kpi-lbl mono-lab">Par</span>
                  </div>
                ) : null}
                {specs.yardage ? (
                  <div className="ov-kpi">
                    <span className="ov-kpi-val display mono-num">{specs.yardage.toLocaleString('en-US')}</span>
                    <span className="ov-kpi-lbl mono-lab">Yards</span>
                  </div>
                ) : null}
                {specs.rating ? (
                  <div className="ov-kpi">
                    <span className="ov-kpi-val display mono-num">{specs.rating}</span>
                    <span className="ov-kpi-lbl mono-lab">Rating</span>
                  </div>
                ) : null}
                {specs.slope ? (
                  <div className="ov-kpi">
                    <span className="ov-kpi-val display mono-num">{specs.slope}</span>
                    <span className="ov-kpi-lbl mono-lab">Slope</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            {specs?.summary ? <p className="ov-prose ov-prose-wide">{specs.summary}</p> : null}
            {content.signatureHole?.description ? (
              <div className="ov-signature">
                <span className="ov-sub mono-lab">Signature hole</span>
                <span className="ov-sig-line display mono-num">
                  Hole {content.signatureHole.number}
                  {content.signatureHole.par ? `, par ${content.signatureHole.par}` : ''}
                  {content.signatureHole.yardage ? `, ${content.signatureHole.yardage} yards` : ''}
                </span>
                <p>{content.signatureHole.description}</p>
              </div>
            ) : null}
            {content.courseRankings.length > 0 ? (
              <div className="ov-rankings">
                {content.courseRankings.map((r, i) => (
                  <div key={i} className="ov-rank">
                    <span className="ov-rank-val display">{r.rank}</span>
                    <span className="ov-rank-pub">{r.publication}</span>
                    {r.description ? <span className="ov-rank-desc">{r.description}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── MEMBERSHIP · tiers ── */}
      {content.membershipTiers.length > 0 ? (
        <section className="section ov" id="membership">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">{name} · Club</span>
              <h2 className="sec-title display">Membership</h2>
            </div>
            <div className="ov-tiers">
              {content.membershipTiers.map((t, i) => (
                <div key={i} className="ov-tier">
                  {t.eyebrow ? <span className="ov-tier-eyebrow mono-lab">{t.eyebrow}</span> : null}
                  <span className="ov-tier-name">{t.name ?? t.label ?? t.tier}</span>
                  {t.description ? <p className="ov-tier-desc">{t.description}</p> : null}
                  {Array.isArray(t.details) && t.details.length > 0 ? (
                    <dl className="ov-tier-details">
                      {t.details.map((d, j) => (
                        <div key={j} className="ov-fact">
                          <dt>{d.label}</dt>
                          {/* "Confirmed at office" read as a placeholder with
                              no next step — the club's own phone (below the
                              tier cards) answered it, but nothing pointed a
                              reader there (design-audit P3). Link straight
                              to it when the value is this unpublished-price
                              placeholder and a number exists. */}
                          {d.value === 'Confirmed at office' && content.membershipOfficePhone ? (
                            <dd className="mono-num">
                              <a href={`tel:${content.membershipOfficePhone.replace(/[^0-9+]/g, '')}`}>
                                Ask the club · {content.membershipOfficePhone}
                              </a>
                            </dd>
                          ) : (
                            <dd className="mono-num">{d.value}</dd>
                          )}
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {t.waitlist_status ? <span className="ov-tier-wait">{t.waitlist_status}</span> : null}
                </div>
              ))}
            </div>
            {content.membershipOfficePhone ? (
              <p className="ov-note mono-num">Membership office: {content.membershipOfficePhone}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── BUILDERS ── */}
      {content.builders.length > 0 ? (
        <section className="section ov" id="builders">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">{name} · Build</span>
              <h2 className="sec-title display">Builders</h2>
            </div>
            <div className="ov-builders">
              {content.builders.map((b, i) => (
                <div key={`${b.name}-${i}`} className="ov-builder">
                  <span className="ov-builder-name">{b.name}</span>
                  {b.role ? <span className="ov-builder-role mono-lab">{b.role}</span> : null}
                  {b.description ? <p className="ov-builder-desc">{b.description}</p> : null}
                  {b.website ? (
                    <a className="ov-builder-link" href={b.website} target="_blank" rel="noopener noreferrer">
                      Visit website <span className="arr">&rarr;</span>
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
