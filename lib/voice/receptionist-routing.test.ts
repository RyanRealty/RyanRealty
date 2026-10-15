import { afterEach, describe, expect, it } from 'vitest'
import { isReceptionistLine, parseReferTarget, receptionistLines, transferTestTarget } from './receptionist-routing'

const PREV_LINES = process.env.RECEPTIONIST_LINES
const PREV_TEST = process.env.RECEPTIONIST_TRANSFER_TEST_TARGET

afterEach(() => {
  if (PREV_LINES === undefined) delete process.env.RECEPTIONIST_LINES
  else process.env.RECEPTIONIST_LINES = PREV_LINES
  if (PREV_TEST === undefined) delete process.env.RECEPTIONIST_TRANSFER_TEST_TARGET
  else process.env.RECEPTIONIST_TRANSFER_TEST_TARGET = PREV_TEST
})

describe('receptionist routing', () => {
  it('defaults to the spare line only', () => {
    delete process.env.RECEPTIONIST_LINES
    expect(isReceptionistLine('+15412245025')).toBe(true)
    expect(isReceptionistLine('+15417033095')).toBe(false)
    expect(receptionistLines()).toEqual(['5412245025'])
  })
  it('enables spare and main when RECEPTIONIST_LINES lists both', () => {
    process.env.RECEPTIONIST_LINES = '+15412245025,+15417033095'
    expect(isReceptionistLine('+15412245025')).toBe(true)
    expect(isReceptionistLine('+15417033095')).toBe(true)
    expect(isReceptionistLine('+15412503380')).toBe(false)
    expect(receptionistLines()).toEqual(['5412245025', '5417033095'])
  })
  it('treats an empty transfer test target as unset', () => {
    process.env.RECEPTIONIST_TRANSFER_TEST_TARGET = ''
    expect(transferTestTarget()).toBeNull()
    process.env.RECEPTIONIST_TRANSFER_TEST_TARGET = '   '
    expect(transferTestTarget()).toBeNull()
    process.env.RECEPTIONIST_TRANSFER_TEST_TARGET = '+15005550006'
    expect(transferTestTarget()).toBe('+15005550006')
  })
  it('allowlists REFER targets', () => {
    expect(parseReferTarget('<tel:+15412503380>', ['+15412503380'])).toBe('+15412503380')
    expect(parseReferTarget('tel:+19995550000', ['+15412503380'])).toBeNull()
    expect(parseReferTarget('', ['+15412503380'])).toBeNull()
    expect(parseReferTarget('<tel:+15412503380>', [null, '+15412503380'])).toBe('+15412503380')
  })
})
