import Link from 'next/link'
import type { HoodDPeer } from './types'

export function HoodDPeers({
  heading,
  peers,
}: {
  heading: string
  peers: HoodDPeer[]
}) {
  if (peers.length === 0) return null

  return (
    <section className="hood-d-section" id="nearby-districts">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">Nearby districts</span>
          <h2 className="hood-d-display">{heading}</h2>
        </div>
        <div className="hood-d-peers">
          {peers.map((peer) => (
            <Link key={peer.href} href={peer.href} className="hood-d-peer">
              {peer.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={peer.img} alt="" />
              ) : null}
              <span className="hood-d-peer-name hood-d-display">{peer.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
