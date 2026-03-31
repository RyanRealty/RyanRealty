'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  GraduationCap,
  Trees,
  UtensilsCrossed,
  ShoppingBag,
  Palette,
  Bus,
  Heart,
  CalendarDays,
  Users,
  Home,
  History,
  Sparkles,
  MapPin,
  HelpCircle,
} from 'lucide-react'
import type {
  PlaceContentRow,
  SchoolItem,
  DiningItem,
  RecreationItem,
  FaqItem,
} from '@/app/actions/place-content'

type Props = {
  content: PlaceContentRow
  placeName: string
}

type ContentSection = {
  key: string
  label: string
  icon: React.ReactNode
  text: string | null
  data?: SchoolItem[] | DiningItem[] | RecreationItem[] | null | undefined
  dataType?: 'schools' | 'dining' | 'recreation' | undefined
}

function renderParagraphs(text: string) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim())
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="leading-relaxed text-muted-foreground">
          {p.trim()}
        </p>
      ))}
    </div>
  )
}

function SchoolsTable({ items }: { items: SchoolItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>School</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Grades</TableHead>
            <TableHead className="hidden sm:table-cell">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                {item.type && <Badge variant="outline" className="text-xs">{item.type}</Badge>}
              </TableCell>
              <TableCell>{item.grades ?? '—'}</TableCell>
              <TableCell className="hidden sm:table-cell">{item.notes ?? ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DiningTable({ items }: { items: DiningItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <Card key={i} className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                {item.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {item.cuisine && <Badge variant="secondary" className="text-xs">{item.cuisine}</Badge>}
                {item.price && <Badge variant="outline" className="text-xs">{item.price}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RecreationTable({ items }: { items: RecreationItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <Card key={i} className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{item.name}</p>
                {item.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>
                )}
              </div>
              {item.type && <Badge variant="secondary" className="text-xs">{item.type}</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function FaqSection({ faqs, placeName }: { faqs: FaqItem[]; placeName: string }) {
  if (faqs.length === 0) return null
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Frequently asked questions about {placeName}
        </h3>
      </div>
      <Accordion type="multiple" className="mt-4">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-foreground">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

export default function PlaceContentSection({ content, placeName }: Props) {
  const allSections: ContentSection[] = [
    { key: 'history', label: 'History and Character', icon: <History className="h-4 w-4" />, text: content.history },
    { key: 'lifestyle', label: 'Lifestyle', icon: <Sparkles className="h-4 w-4" />, text: content.lifestyle },
    { key: 'schools', label: 'Schools and Education', icon: <GraduationCap className="h-4 w-4" />, text: content.schools, data: content.schools_data, dataType: 'schools' as const },
    { key: 'outdoor_recreation', label: 'Outdoor Recreation', icon: <Trees className="h-4 w-4" />, text: content.outdoor_recreation, data: content.recreation_data, dataType: 'recreation' as const },
    { key: 'dining', label: 'Dining and Food', icon: <UtensilsCrossed className="h-4 w-4" />, text: content.dining, data: content.dining_data, dataType: 'dining' as const },
    { key: 'shopping', label: 'Shopping and Services', icon: <ShoppingBag className="h-4 w-4" />, text: content.shopping },
    { key: 'arts_culture', label: 'Arts and Culture', icon: <Palette className="h-4 w-4" />, text: content.arts_culture },
    { key: 'transportation', label: 'Transportation', icon: <Bus className="h-4 w-4" />, text: content.transportation },
    { key: 'healthcare', label: 'Healthcare', icon: <Heart className="h-4 w-4" />, text: content.healthcare },
    { key: 'events_festivals', label: 'Events and Festivals', icon: <CalendarDays className="h-4 w-4" />, text: content.events_festivals },
    { key: 'family_life', label: 'Family Life', icon: <Users className="h-4 w-4" />, text: content.family_life },
    { key: 'real_estate_overview', label: 'Real Estate', icon: <Home className="h-4 w-4" />, text: content.real_estate_overview },
  ]
  const sections = allSections.filter((s): s is ContentSection => !!s.text?.trim())

  if (sections.length === 0 && !content.overview && (!content.faqs || content.faqs.length === 0)) {
    return null
  }

  const topSections = sections.slice(0, 4)
  const moreSections = sections.slice(4)
  const [showAll, setShowAll] = useState(false)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" id="place-content">
      {content.overview && (
        <section>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              About {placeName}
            </h2>
          </div>
          <div className="mt-4">
            {renderParagraphs(content.overview)}
          </div>
        </section>
      )}

      {topSections.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="grid gap-6 md:grid-cols-2">
            {topSections.map((section) => (
              <ContentCard key={section.key} section={section} />
            ))}
          </div>
        </>
      )}

      {moreSections.length > 0 && (
        <>
          {showAll ? (
            <>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {moreSections.map((section) => (
                  <ContentCard key={section.key} section={section} />
                ))}
              </div>
              <div className="mt-4 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAll(false)}>
                  Show less
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => setShowAll(true)}>
                Show {moreSections.length} more sections about {placeName}
              </Button>
            </div>
          )}
        </>
      )}

      {content.faqs && content.faqs.length > 0 && (
        <>
          <Separator className="my-8" />
          <FaqSection faqs={content.faqs} placeName={placeName} />
        </>
      )}
    </div>
  )
}

function ContentCard({ section }: { section: ContentSection }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <span className="text-primary">{section.icon}</span>
          <h3 className="font-semibold text-foreground">{section.label}</h3>
        </div>
        <div className="mt-3">
          {section.text && renderParagraphs(section.text)}
        </div>
        {section.dataType === 'schools' && section.data && (section.data as SchoolItem[]).length > 0 && (
          <SchoolsTable items={section.data as SchoolItem[]} />
        )}
        {section.dataType === 'dining' && section.data && (section.data as DiningItem[]).length > 0 && (
          <DiningTable items={section.data as DiningItem[]} />
        )}
        {section.dataType === 'recreation' && section.data && (section.data as RecreationItem[]).length > 0 && (
          <RecreationTable items={section.data as RecreationItem[]} />
        )}
      </CardContent>
    </Card>
  )
}
