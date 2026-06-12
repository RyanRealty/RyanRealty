'use client'

/** Design-system Select for choosing a broker inside server-action forms. */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function BrokerSelect(props: {
  name: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
  defaultValue?: string
}) {
  return (
    <Select name={props.name} defaultValue={props.defaultValue}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={props.placeholder ?? 'Select'} />
      </SelectTrigger>
      <SelectContent>
        {props.options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
