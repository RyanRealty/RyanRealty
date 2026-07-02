'use client'

/**
 * NewTaskDialog — create a task from the queue. Includes a searchable contact
 * picker (Popover + Command) so brokers do not need to know the numeric CRM
 * person id. Optionally auto-opens when the parent passes autoOpen={true}
 * (used by the dashboard FAB via ?new=1 on the tasks page).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import type { ContactSearchHit } from '@/app/actions/crm-tasks'

export default function NewTaskDialog({
  taskTypes,
  createAction,
  searchAction,
  autoOpen = false,
}: {
  taskTypes: CrmTaskType[]
  createAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  searchAction: (q: string) => Promise<{ ok: boolean; results?: ContactSearchHit[]; error?: string }>
  autoOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Contact picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ContactSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<ContactSearchHit | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Task fields
  const [name, setName] = useState('')
  const [type, setType] = useState('Follow Up')
  const [dueHours, setDueHours] = useState('24')

  const activeTypes = taskTypes.filter((t) => t.isActive)

  // Auto-open for ?new=1 FAB
  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  // Debounced contact search
  useEffect(() => {
    if (!pickerOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const res = await searchAction(query)
      setSearching(false)
      if (res.ok && res.results) setSearchResults(res.results)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, pickerOpen, searchAction])

  function resetForm() {
    setSelectedPerson(null)
    setQuery('')
    setSearchResults([])
    setName('')
    setType('Follow Up')
    setDueHours('24')
    setError(null)
  }

  const submit = () => {
    setError(null)
    const fd = new FormData()
    if (selectedPerson) fd.set('personId', String(selectedPerson.id))
    fd.set('name', name.trim())
    fd.set('type', type)
    fd.set('dueHours', dueHours || '24')
    startTransition(async () => {
      const res = await createAction(fd)
      if (!res.ok) {
        setError(res.error ?? 'Could not create the task')
        return
      }
      setOpen(false)
      resetForm()
      router.refresh()
    })
  }

  const canSubmit = !pending && name.trim().length > 0 && selectedPerson !== null

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-10 sm:h-9">
          New task
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">

          {/* Task name */}
          <div className="space-y-1.5">
            <Label htmlFor="new-task-name">Task</Label>
            <Input
              id="new-task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Call back about the offer"
            />
          </div>

          {/* Contact picker */}
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedPerson ? (
                    <span className="truncate">{selectedPerson.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Search contacts…</span>
                  )}
                  <svg
                    aria-hidden
                    className="ml-2 size-4 shrink-0 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name…"
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList>
                    {searching ? (
                      <CommandEmpty>Searching…</CommandEmpty>
                    ) : query.trim() && searchResults.length === 0 ? (
                      <CommandEmpty>No contacts found.</CommandEmpty>
                    ) : !query.trim() ? (
                      <CommandEmpty>Type a name to search.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {searchResults.map((hit) => (
                          <CommandItem
                            key={hit.id}
                            value={String(hit.id)}
                            onSelect={() => {
                              setSelectedPerson(hit)
                              setPickerOpen(false)
                              setQuery('')
                              setSearchResults([])
                            }}
                          >
                            {hit.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">A task must be linked to a contact.</p>
          </div>

          {/* Task type */}
          <div className="space-y-1.5">
            <Label htmlFor="new-task-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="new-task-type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {activeTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due in hours */}
          <div className="space-y-1.5">
            <Label htmlFor="new-task-due">Due in (hours)</Label>
            <Input
              id="new-task-due"
              type="number"
              min="1"
              value={dueHours}
              onChange={(e) => setDueHours(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" disabled={!canSubmit} onClick={submit}>
            {pending ? 'Creating…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
