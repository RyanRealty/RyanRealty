'use client'
import { useRouter, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  currentDate: string
}

/**
 * Properties report filter bar — date preset only.
 *
 * FUB Properties tab has no agent filter and no lead-type filter — only "This Month ▼".
 * This matches that spec exactly.
 */
export default function PropertiesFilters({ currentDate }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({ date: currentDate, ...updates })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Select value={currentDate} onValueChange={(v) => navigate({ date: v })}>
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue placeholder="This Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="this_year">This Year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
