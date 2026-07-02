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

export default function MarketingFilters({ currentDate }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* Attribution model — session-level UTM capture is all-touch by nature;
          FUB's First Touch model needs per-lead first-source stamping (deferred) */}
      <Select value="all_touch" onValueChange={() => {}}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="All touch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all_touch">All touch</SelectItem>
          <SelectItem value="first_touch" disabled>
            First touch
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Date range */}
      <Select
        value={currentDate}
        onValueChange={(v) => router.push(`${pathname}?date=${v}`)}
      >
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
