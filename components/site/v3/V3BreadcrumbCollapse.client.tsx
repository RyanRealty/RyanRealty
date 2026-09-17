'use client'

/**
 * Middle-trail disclosure for V3Breadcrumb. The house trail stays a server
 * component; this island only holds the ellipsis open state.
 */
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BreadcrumbEllipsis } from '@/components/ui/breadcrumb'
import type { V3Crumb } from './V3Breadcrumb'

export function V3BreadcrumbCollapse({ crumbs }: { crumbs: readonly V3Crumb[] }) {
  const router = useRouter()
  if (crumbs.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className="v3-breadcrumb__collapse"
        aria-label="Show the rest of the path"
      >
        <BreadcrumbEllipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="v3-breadcrumb__collapse-menu">
        {crumbs.map((crumb, index) => (
          <DropdownMenuItem
            key={`${index}-${crumb.label}`}
            disabled={!crumb.href}
            onSelect={() => {
              if (crumb.href) router.push(crumb.href)
            }}
          >
            {crumb.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
