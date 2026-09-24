/**
 * lib/studio/story/cast.ts — the people in a story film.
 *
 * Shot-to-shot memory does not exist in a generator. A couple who are the same
 * two people in eleven shots is engineered: one reference sheet per person,
 * generated once, judged, locked, and handed back as a source image on every
 * still that person appears in. Wardrobe is named per scene so the sheet
 * carries the face and the prompt carries the clothes.
 *
 * Cast members are invented characters. Never a real, identifiable person,
 * never a broker's words (VOICE.md), and never presented as who lives here.
 */
import type { EraPack } from './eras'

export type CastSlot = 'A' | 'B'

export type WardrobeKey = 'travel' | 'ski' | 'apres' | 'dinner' | 'evening' | 'summer' | 'work'

export type CastMember = {
  slot: CastSlot
  /** Face, hair, build, age: what the reference sheet must lock. */
  look: string
  /** Pronoun the prompts use. */
  pronoun: 'she' | 'he' | 'they'
  wardrobe: Partial<Record<WardrobeKey, string>>
}

export type Cast = Record<CastSlot, CastMember>

/** Short handle for a member inside a prompt ("the woman", "the man"). */
export function castHandle(member: CastMember): string {
  return member.pronoun === 'she' ? 'the woman' : member.pronoun === 'he' ? 'the man' : 'the person'
}

export function wardrobeFor(member: CastMember, key: WardrobeKey): string {
  const outfit = member.wardrobe[key]
  if (!outfit) throw new Error(`cast ${member.slot} has no "${key}" wardrobe`)
  return outfit
}

/**
 * The reference sheet: a plain, evenly lit portrait that locks the face. It is
 * deliberately NOT a period film frame; the sheet exists to carry identity, so
 * it is lit and framed for identity.
 */
export function castSheetSpec(
  member: CastMember,
  era: EraPack,
): {
  framing: string
  light: string
  action: string
  materials: string
  place: string
} {
  return {
    framing: 'waist-up portrait facing the camera, 50mm at eye level',
    light: 'soft overcast daylight from the front, 5600K, even and shadowless',
    action: `${castHandle(member)} looks straight into the lens with a relaxed, natural half smile`,
    materials: `${member.look}; wearing ${wardrobeFor(member, 'travel')}; ${member.pronoun === 'she' ? era.period.hair.she : era.period.hair.he}`,
    place: 'a plain pale wall behind',
  }
}
