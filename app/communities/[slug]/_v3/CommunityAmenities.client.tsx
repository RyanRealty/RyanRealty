/**
 * The places on a community, from the community guide.
 * Name, what it is, and who can go when that line is a sentence.
 * No share bar. A place with a recorded page is a link.
 */

import type { CommunityAmenityBoard } from './community-amenities'

export function CommunityAmenities({ board }: { board: CommunityAmenityBoard }) {
  return (
    <div className="v3-amenity-groups">
      {board.groups.map((group) => (
        <section key={group.label} className="v3-amenity-group" aria-label={group.label}>
          <h3 className="v3-amenity-group__label">{group.label}</h3>
          <ul className="v3-amenity-group__list">
            {group.places.map((place) => (
              <li key={place.name} className="v3-amenity-place">
                {place.href ? (
                  <a className="v3-amenity-place__name" href={place.href}>
                    {place.name}
                  </a>
                ) : (
                  <p className="v3-amenity-place__name">{place.name}</p>
                )}
                {place.description ? <p className="v3-amenity-place__body">{place.description}</p> : null}
                {place.access ? <p className="v3-amenity-place__access">{place.access}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
