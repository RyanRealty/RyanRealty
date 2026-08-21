import type { CommDGroundTile } from '@/lib/communities/comm-d-ground'

export function CommDGround({
  name,
  tiles,
}: {
  name: string
  tiles: readonly CommDGroundTile[]
}) {
  if (tiles.length === 0) return null
  return (
    <section className="comm-d-section" aria-labelledby="comm-d-ground">
      <div className="comm-d-wrap">
        <div className="comm-d-section-head">
          <span className="comm-d-eyebrow">{name}</span>
          <h2 id="comm-d-ground" className="comm-d-display">
            On the ground
          </h2>
        </div>
        <div className="comm-d-ground-grid">
          {tiles.map((tile) => (
            <article key={tile.kicker} className="comm-d-ground-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tile.img} alt="" />
              <p>{tile.kicker}</p>
              <h3>{tile.title}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
