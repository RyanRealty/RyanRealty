import { describe, expect, it } from 'vitest'
import {
  cmaComposeEmailBody,
  cmaComposeEmailSubject,
  cmaComposePdfFilename,
  cmaComposeSmsBody,
} from './crm-compose-copy'

describe('cma compose copy', () => {
  it('keeps SE on 648 SE Douglas and does not point at a public draft URL', () => {
    const address = '648 SE Douglas, Bend, OR 97702'
    expect(cmaComposeEmailSubject(address)).toBe('CMA — 648 SE Douglas, Bend, OR 97702')
    expect(cmaComposeEmailBody(address)).toContain('648 SE Douglas')
    expect(cmaComposeEmailBody(address)).not.toContain('/cma/')
    expect(cmaComposeSmsBody(address)).toBe('CMA for 648 SE Douglas, Bend, OR 97702 is attached.')
    expect(cmaComposePdfFilename('cma-648-se-douglas')).toBe('cma-648-se-douglas.pdf')
  })
})
