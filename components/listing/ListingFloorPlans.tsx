'use client'

import type { SparkFloorPlan } from '../../lib/spark'

type Props = { floorPlans: SparkFloorPlan[] }

export default function ListingFloorPlans({ floorPlans }: Props) {
  if (!floorPlans.length) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {floorPlans.map((fp, i) => (
        <div
          key={fp.Id ?? i}
          className="overflow-hidden rounded-lg border border-border bg-card p-2 shadow-sm"
        >
          {fp.Uri ? (
            <a
              href={fp.Uri}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={fp.Uri}
                alt={fp.Name ?? `Floor plan ${i + 1}`}
                width={400}
                height={300}
                className="w-full rounded-lg object-contain"
                decoding="async"
              />
            </a>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-muted-foreground">
              No image
            </div>
          )}
          {fp.Name && (
            <p className="mt-2 text-center text-sm font-medium text-muted-foreground">
              {fp.Name}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
