'use client'

/**
 * Client gallery body with a note field under every component and a Submit bar.
 * Notes persist in localStorage as you type. Submit compiles all non-empty notes
 * into a single block, copies it to the clipboard, and shows it so it can be
 * pasted straight back into chat (no backend, works on prod's read-only FS).
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import {
  Body,
  Caption,
  DisplayHeading,
  Eyebrow,
  H1,
  H2,
  H3,
  Price,
  TabularNumber,
  MiddleDot,
} from '@/components/site/primitives'

const STORAGE_KEY = 'rr_component_notes_v1'

export default function ComponentGalleryClient() {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [compiled, setCompiled] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setNotes(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  function setNote(name: string, value: string) {
    setNotes((prev) => {
      const next = { ...prev, [name]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  function submit() {
    const lines = Object.entries(notes)
      .filter(([, v]) => v.trim())
      .map(([name, v]) => `### ${name}\n${v.trim()}`)
    setCompiled(lines.length ? `Component notes\n\n${lines.join('\n\n')}` : '(no notes yet)')
    setCopied(false)
  }

  async function copy() {
    if (!compiled) return
    try {
      await navigator.clipboard.writeText(compiled)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function clearAll() {
    if (!confirm('Clear all notes?')) return
    setNotes({})
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const noteCount = Object.values(notes).filter((v) => v.trim()).length

  function Spec({ name, file, children }: { name: string; file: string; children: React.ReactNode }) {
    return (
      <section className="border-b border-border py-8">
        <div className="mb-4 flex items-baseline gap-3">
          <h3 className="text-base font-semibold text-foreground">{name}</h3>
          <code className="text-xs text-muted-foreground">{file}</code>
          {notes[name]?.trim() ? <Badge variant="secondary">noted</Badge> : null}
        </div>
        <div className="flex flex-wrap items-start gap-4">{children}</div>
        <Textarea
          value={notes[name] ?? ''}
          onChange={(e) => setNote(name, e.target.value)}
          placeholder={`Notes on ${name}…`}
          className="mt-4 max-w-2xl"
          rows={2}
        />
      </section>
    )
  }

  return (
    <main className="mx-auto max-w-5xl bg-background px-6 py-10 pb-28">
      <H1 className="text-3xl">Component gallery</H1>
      <Body tone="muted" className="mt-2">
        Design-system atoms at real styles. Add a note under any component, then Submit to compile them.
      </Body>

      <H2 className="mt-12 text-xl">Typography and primitives</H2>
      <Spec name="DisplayHeading / H1 H2 H3" file="components/site/primitives/Headings">
        <div className="space-y-2">
          <DisplayHeading as="p" className="text-4xl text-foreground">Display heading (Amboqia)</DisplayHeading>
          <H1 className="text-3xl">H1 heading</H1>
          <H2 className="text-2xl">H2 heading</H2>
          <H3>H3 heading</H3>
        </div>
      </Spec>
      <Spec name="Eyebrow / Body / Caption" file="components/site/primitives/Body">
        <div className="space-y-2">
          <Eyebrow>Eyebrow label</Eyebrow>
          <Body>Body text in Geist, the workhorse paragraph style for the site.</Body>
          <Caption tone="muted">Caption · smaller muted supporting text</Caption>
        </div>
      </Spec>
      <Spec name="Price / TabularNumber / MiddleDot" file="components/site/primitives">
        <div className="flex items-center gap-3 text-lg">
          <Price value={742000} /> <MiddleDot /> <TabularNumber value={1842} /> active <MiddleDot /> 15 days
        </div>
      </Spec>

      <H2 className="mt-12 text-xl">Button variants and sizes</H2>
      <Spec name="Button variants" file="components/ui/button">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Spec>
      <Spec name="Button sizes" file="components/ui/button">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </Spec>

      <H2 className="mt-12 text-xl">Badge</H2>
      <Spec name="Badge variants" file="components/ui/badge">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </Spec>

      <H2 className="mt-12 text-xl">Card</H2>
      <Spec name="Card" file="components/ui/card">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Card description text.</CardDescription>
          </CardHeader>
          <CardContent>Card body content sits here.</CardContent>
          <CardFooter>
            <Button size="sm">Action</Button>
          </CardFooter>
        </Card>
      </Spec>

      <H2 className="mt-12 text-xl">Form controls</H2>
      <Spec name="Input / Label / Textarea" file="components/ui/input, label, textarea">
        <div className="w-72 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-input">Email</Label>
            <Input id="g-input" placeholder="you@example.com" />
          </div>
          <Textarea placeholder="Message" />
        </div>
      </Spec>
      <Spec name="Select" file="components/ui/select">
        <Select>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Choose a city" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bend">Bend</SelectItem>
            <SelectItem value="redmond">Redmond</SelectItem>
            <SelectItem value="sisters">Sisters</SelectItem>
          </SelectContent>
        </Select>
      </Spec>
      <Spec name="Checkbox / Switch / Radio" file="components/ui/checkbox, switch, radio-group">
        <div className="space-y-3">
          <Label className="flex items-center gap-2"><Checkbox defaultChecked /> Checkbox</Label>
          <Label className="flex items-center gap-2"><Switch defaultChecked /> Switch</Label>
          <RadioGroup defaultValue="a" className="flex gap-4">
            <Label className="flex items-center gap-2"><RadioGroupItem value="a" /> Option A</Label>
            <Label className="flex items-center gap-2"><RadioGroupItem value="b" /> Option B</Label>
          </RadioGroup>
        </div>
      </Spec>
      <Spec name="Slider" file="components/ui/slider">
        <Slider defaultValue={[60]} max={100} step={1} className="w-72" />
      </Spec>

      <H2 className="mt-12 text-xl">Feedback and status</H2>
      <Spec name="Alert" file="components/ui/alert">
        <Alert className="w-96">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>An alert with a title and description.</AlertDescription>
        </Alert>
      </Spec>
      <Spec name="Progress / Skeleton" file="components/ui/progress, skeleton">
        <div className="w-72 space-y-3">
          <Progress value={64} />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Spec>
      <Spec name="Avatar" file="components/ui/avatar">
        <Avatar><AvatarFallback>MR</AvatarFallback></Avatar>
      </Spec>
      <Spec name="Separator" file="components/ui/separator">
        <div className="w-72">
          <p className="text-sm">Above</p>
          <Separator className="my-2" />
          <p className="text-sm">Below</p>
        </div>
      </Spec>

      <H2 className="mt-12 text-xl">Disclosure and navigation</H2>
      <Spec name="Tabs" file="components/ui/tabs">
        <Tabs defaultValue="one" className="w-96">
          <TabsList>
            <TabsTrigger value="one">Tab one</TabsTrigger>
            <TabsTrigger value="two">Tab two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First panel.</TabsContent>
          <TabsContent value="two">Second panel.</TabsContent>
        </Tabs>
      </Spec>
      <Spec name="Accordion" file="components/ui/accordion">
        <Accordion type="single" collapsible className="w-96">
          <AccordionItem value="a">
            <AccordionTrigger>First question</AccordionTrigger>
            <AccordionContent>The collapsible answer.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Second question</AccordionTrigger>
            <AccordionContent>Another answer.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Spec>

      <H2 className="mt-12 text-xl">Table</H2>
      <Spec name="Table" file="components/ui/table">
        <Table className="w-96">
          <TableHeader>
            <TableRow><TableHead>City</TableHead><TableHead>Active</TableHead><TableHead>Median</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell>Bend</TableCell><TableCell className="tabular-nums">542</TableCell><TableCell className="tabular-nums">$790,000</TableCell></TableRow>
            <TableRow><TableCell>Redmond</TableCell><TableCell className="tabular-nums">188</TableCell><TableCell className="tabular-nums">$475,000</TableCell></TableRow>
          </TableBody>
        </Table>
      </Spec>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <span className="text-sm text-muted-foreground">
            <TabularNumber value={noteCount} /> {noteCount === 1 ? 'note' : 'notes'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
            <Button size="sm" onClick={submit}>Submit notes</Button>
          </div>
        </div>
      </div>

      {/* Compiled-notes panel */}
      {compiled !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/50 p-4" onClick={() => setCompiled(null)}>
          <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Your notes</CardTitle>
              <CardDescription>Copy this and paste it back into chat.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea readOnly value={compiled} rows={12} className="font-mono text-xs" />
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={copy}>{copied ? 'Copied' : 'Copy to clipboard'}</Button>
              <Button variant="outline" onClick={() => setCompiled(null)}>Close</Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </main>
  )
}
