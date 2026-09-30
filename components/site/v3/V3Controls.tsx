/**
 * V3 CONTROLS. A quiet set of one-step choices: each row is a name, one quiet
 * line under it, and ONE form (a submit button, optionally with one select).
 *
 * WHY A PRIMITIVE. The market-report preferences page (/email-preferences,
 * Matt 2026-09-29) is a utility surface: pause, resume, stop, how often, which
 * areas, and "stop all email". None of those is a Sheet (a multi-step form
 * with one question visible at a time) and none is a Quiet door (a link). A
 * page that hand-rolled its own form rows would be the one-off second design
 * system ci:one-design-system exists to stop, so the rows are a barrel
 * primitive reading tokens.css like every other pattern.
 *
 * HOW IT BEHAVES. Every row is a real <form> posting to a server action, so it
 * works before hydration and with JavaScript off; there is no client state in
 * this file. The rows sit on the Quiet hairline rhythm, so a Controls block
 * reads as the working half of the Quiet block above it rather than as a card.
 *
 * Barrel law: imports ./atoms, ./V3Input, ./tokens.css and @/lib/utils only.
 * Raw form elements live here (the barrel owns the controls). Every color,
 * size and rule comes from ./tokens.css.
 */
import { cn } from '@/lib/utils'
import { V3Button, V3Eyebrow, V3Heading, V3_ROOT_CLASS, type V3ButtonVariant } from './atoms'
import { V3Input, type V3InputOption } from './V3Input'
import './tokens.css'
import './V3Controls.css'

export type V3ControlsSelect = {
  /** The field name the action reads. */
  name: string
  /** The select's accessible label (visible above it). */
  label: string
  options: readonly V3InputOption[]
  defaultValue?: string
}

export type V3ControlsRow = {
  /** Unique within the block; also the row's hash target. */
  id: string
  /** The row's name: what the choice is. */
  term: string
  /** One quiet line under the name: the current state or the consequence. */
  detail?: string
  /** A server action. The row's form posts to it. */
  action: (formData: FormData) => void | Promise<void>
  /** The submit label. The visible text is the button's accessible name. */
  submit: string
  /** 'ghost' by default. At most one 'primary' in view (PUBLIC_UI one-ask rule). */
  variant?: V3ButtonVariant
  /** One select submitted with the button (how often, which area). */
  select?: V3ControlsSelect
  /** Fixed values the form submits (which area a Remove button removes). */
  hidden?: Readonly<Record<string, string>>
}

export type V3ControlsProps = {
  /** The region's visible title and accessible name. */
  heading: string
  headingLevel?: 1 | 2
  /** The uppercase context line above the title. */
  eyebrow?: string
  /** One quiet sentence under the title. */
  note?: string
  rows: readonly V3ControlsRow[]
  /**
   * A quiet way out, under the rows: "Keep my email on" beside a confirmation.
   * A link, never a form, so leaving changes nothing.
   */
  exit?: { label: string; href: string }
  id?: string
  className?: string
}

export function V3Controls({ heading, headingLevel = 2, eyebrow, note, rows, exit, id, className }: V3ControlsProps) {
  const title = heading.trim()
  const visible = rows.filter((r) => r.term.trim() && r.submit.trim())
  if (!title || visible.length === 0) return null
  const headingId = `${id ?? 'controls'}-heading`

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'v3-controls', className)} aria-labelledby={headingId}>
      <div className="v3-controls__head">
        {eyebrow ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
        <V3Heading level={headingLevel} id={headingId} className="v3-controls__heading">
          {title}
        </V3Heading>
        {note ? <p className="v3-controls__note">{note}</p> : null}
      </div>
      <ul className="v3-controls__list">
        {visible.map((row) => (
          <li key={row.id} id={row.id} className="v3-controls__item">
            <form action={row.action} className="v3-controls__row">
              <div className="v3-controls__text">
                <p className="v3-controls__term">{row.term}</p>
                {row.detail ? <p className="v3-controls__detail">{row.detail}</p> : null}
              </div>
              <div className="v3-controls__act">
                {row.hidden
                  ? Object.entries(row.hidden).map(([name, value]) => (
                      <input key={name} type="hidden" name={name} value={value} />
                    ))
                  : null}
                {row.select ? (
                  <V3Input
                    id={`${row.id}-${row.select.name}`}
                    name={row.select.name}
                    label={row.select.label}
                    kind="select"
                    required
                    options={row.select.options}
                    defaultValue={row.select.defaultValue}
                    className="v3-controls__select"
                  />
                ) : null}
                <V3Button type="submit" variant={row.variant ?? 'ghost'} className="v3-controls__submit">
                  {row.submit}
                </V3Button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      {exit && exit.label.trim() && exit.href ? (
        <p className="v3-controls__exit">
          <V3Button href={exit.href} variant="text" prefetch={false}>
            {exit.label}
          </V3Button>
        </p>
      ) : null}
    </section>
  )
}
