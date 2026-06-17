/**
 * KB About (editorial intro) — the honest "about this place" block for a city or
 * community page. Asymmetric brutalist split: the heading + prose sit on the left
 * at a readable measure, a quick-facts ledger sits on the right as hard hairline
 * rows (mono uppercase label left, tabular-nums value right). Server component:
 * it renders the data it is handed and fetches nothing. Cream surface, navy text
 * so it alternates against the navy sections (Region, Market, Communities rail).
 *
 * Renders null when there is no prose to show.
 */

interface KbAboutFact {
  label: string
  value: string
}

interface KbAboutProps {
  eyebrow: string
  heading: string
  paragraphs: string[]
  facts: KbAboutFact[]
}

export function KbAbout({ eyebrow, heading, paragraphs, facts }: KbAboutProps) {
  if (!paragraphs.length) return null

  return (
    <section className="section about" id="about">
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{heading}</h2>
        </div>

        <div className="about-grid">
          <div className="about-prose">
            {paragraphs.map((p, i) => (
              <p key={i} className="about-p">
                {p}
              </p>
            ))}
          </div>

          {facts.length ? (
            <aside className="about-ledger" aria-label="Quick facts">
              <span className="about-ledger-cap eyebrow">By the numbers</span>
              <dl className="about-facts">
                {facts.map((f, i) => (
                  <div key={i} className="about-fact">
                    <dt className="about-fact-lbl">{f.label}</dt>
                    <dd className="about-fact-val mono-num">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  )
}
