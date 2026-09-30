/**
 * /commercial-space-for-lease: the map beside the town ledger (2026-09-30).
 *
 * A server component with no client code: the highway skeleton and the rivers
 * as hairlines, every lease a dot at its listing's own coordinates (a door to
 * its page, labelled in the card's words on hover or focus), and each town's
 * name and count as the same door its ledger row is. Hovering a town's row in
 * the ledger lights that town's dots and name here, and hovering its name or a
 * dot here opens the row's reveal there (lease-map.css, by the row's order).
 *
 * The geometry is lease-map.ts's; nothing here computes a figure.
 */
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { leaseMapSizeKey, type LeaseMapModel } from './lease-map'
import './lease-map.css'

export function LeaseMap({ model, id = 'lease-map' }: { model: LeaseMapModel; id?: string }) {
  const sizeKey = leaseMapSizeKey(model.sizeRange)
  const captionId = `${id}-caption`
  return (
    <figure id={id} className="lease-map" aria-labelledby={captionId}>
      <div className="lease-map__frame" style={{ aspectRatio: `${model.width} / ${model.height}` }}>
        <svg
          className="lease-map__ground"
          viewBox={`0 0 ${model.width} ${model.height}`}
          aria-hidden="true"
          focusable="false"
        >
          {model.rivers ? <path className="lease-map__river" d={model.rivers} /> : null}
          {model.roads ? <path className="lease-map__road" d={model.roads} /> : null}
        </svg>
        <ul className="lease-map__dots" aria-label="Each space on the map">
          {model.dots.map((dot) => (
            <li
              key={dot.key}
              className={cn(
                'lease-map__spot',
                dot.x > 62 && 'lease-map__spot--east',
                dot.x < 38 && 'lease-map__spot--west',
                dot.y < 22 && 'lease-map__spot--north',
              )}
              data-row={dot.row}
              style={{ left: `${dot.x}%`, top: `${dot.y}%`, '--lease-dot-r': `${dot.r}px` } as CSSProperties}
            >
              <a
                href={dot.href}
                className={cn('lease-map__dot', dot.unsized && 'lease-map__dot--ring')}
                aria-label={dot.label}
              >
                <span className="lease-map__tip" aria-hidden="true">
                  {dot.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <ul className="lease-map__towns" aria-label="Towns on the map">
          {model.towns.map((town) => (
            <li
              key={town.slug}
              className={cn('lease-map__town', `lease-map__town--${town.side}`)}
              data-row={town.row}
              style={{ left: `${town.x}%`, top: `${town.y}%` }}
            >
              <a href={town.href} className="lease-map__town-link">
                <span className="lease-map__town-name">{town.label}</span>
                <span className="lease-map__town-count">{town.countLabel}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <figcaption id={captionId} className="lease-map__key">
        <span className="lease-map__key-line">
          Each dot is one space at its listing’s address
          {sizeKey ? ', drawn to the square feet it lists' : ''}, and a door to it.
        </span>
        {sizeKey ? (
          <span className="lease-map__scale">
            <span
              className="lease-map__swatch"
              style={{ '--lease-dot-r': `${model.sizeRange!.rMin}px` } as CSSProperties}
            />
            <span>{sizeKey.small}</span>
            <span
              className="lease-map__swatch"
              style={{ '--lease-dot-r': `${model.sizeRange!.rMax}px` } as CSSProperties}
            />
            <span>{sizeKey.large}</span>
            {model.unsizedCount > 0 ? (
              <>
                <span className="lease-map__swatch lease-map__swatch--ring" />
                <span>size not listed</span>
              </>
            ) : null}
          </span>
        ) : null}
        {model.basemapSource ? (
          <span className="lease-map__source">Highways and rivers: {model.basemapSource}</span>
        ) : null}
      </figcaption>
    </figure>
  )
}
