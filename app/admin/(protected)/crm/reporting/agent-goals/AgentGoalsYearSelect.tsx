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
  currentYear: number
}

// Show 2 prior years, current year, and 1 future year
function buildYearOptions(currentYear: number): number[] {
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]
}

export function AgentGoalsYearSelect({ currentYear }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const years = buildYearOptions(new Date().getFullYear())

  function onYearChange(value: string) {
    router.push(`${pathname}?year=${value}`)
  }

  return (
    <Select value={String(currentYear)} onValueChange={onYearChange}>
      <SelectTrigger className="h-8 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)} className="text-xs">
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
