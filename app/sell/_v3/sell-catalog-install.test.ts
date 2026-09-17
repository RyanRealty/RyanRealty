import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('SITE-111 sell catalog install', () => {
  it('imports the three replaceWith sources on the route _v3 set', () => {
    const form = read('app/sell/_v3/SellValueForm.tsx')
    const field = read('app/sell/_v3/SellAddressField.tsx')
    const button = read('components/motion/expanding-arrow-button.tsx')
    const group = read('components/ui/input-group.tsx')
    const input = read('components/motion/input.tsx')

    expect(form).toMatch(/from '@\/components\/motion\/expanding-arrow-button'/)
    expect(form).toMatch(/from '@\/components\/motion\/input'/)
    expect(field).toMatch(/from '@\/components\/ui\/input-group'/)
    expect(field).toMatch(/from '@\/components\/motion\/input'/)
    expect(form).toContain('<ExpandingArrowButton')
    expect(form).toContain('type="submit"')
    expect(form).toContain('data-taste="ask-open"')
    expect(field).toContain('variant="motion"')
    expect(field).toContain('InputGroup')
    expect(field).toContain('sell-field__confirm')
    expect(button).toContain('DottedChevron')
    expect(button).toContain('ARROW_OPACITY')
    expect(button).toContain('layout="size"')
    expect(group).toContain('data-slot="input-group"')
    expect(input).toContain('hasError && "border-destructive ring-2 ring-destructive/25"')
    expect(input).toContain('focused && !hasError && "border-foreground/40 ring-2 ring-ring/40"')
  })

  it('does not house-paint catalog error/focus into a border-only navy bump', () => {
    const css = read('app/sell/_v3/sell-stage.css')
    expect(css).not.toMatch(/sell-field__box\[data-state='error'\]/)
    expect(css).not.toMatch(/sell-field__box\[data-state='focused'\]/)
    expect(css).not.toContain('sell-stage-submit__arrow')
  })
})
