/**
 * Type Two resort communities — full Oregon list per master instruction set.
 * Subdivision names here should be cross-referenced with SPARK subdivision data.
 * Used for Resort schema, hero/lifestyle sections, and microsite treatment.
 */
import { subdivisionEntityKey } from './slug'

/** City + subdivision pairs. Normalize subdivision display names to match SPARK where needed. */
const RESORT_CITY_SUBDIVISIONS: { city: string; subdivision: string }[] = [
  // Central Oregon — Bend
  { city: 'Bend', subdivision: 'Tetherow' },
  { city: 'Bend', subdivision: 'Pronghorn' },
  { city: 'Bend', subdivision: 'Juniper Preserve' }, // Pronghorn / Juniper Preserve
  { city: 'Bend', subdivision: 'Broken Top' },
  { city: 'Bend', subdivision: 'Awbrey Glen' },
  { city: 'Bend', subdivision: 'Widgi Creek' },
  { city: 'Bend', subdivision: "River's Edge" },
  { city: 'Bend', subdivision: 'Lost Tracks' },
  { city: 'Bend', subdivision: 'Sunset View' },
  { city: 'Bend', subdivision: 'Mountain High' },
  { city: 'Bend', subdivision: 'Seventh Mountain' },
  { city: 'Bend', subdivision: 'Mt. Bachelor Village' },
  // Sunriver and La Pine
  { city: 'Sunriver', subdivision: 'Sunriver' },
  { city: 'Sunriver', subdivision: 'Sunriver Resort' },
  { city: 'Bend', subdivision: 'Crosswater' },
  { city: 'Sunriver', subdivision: 'Caldera Springs' },
  { city: 'Bend', subdivision: 'Vandevert Ranch' },
  // Powell Butte
  { city: 'Powell Butte', subdivision: 'Brasada Ranch' },
  { city: 'Powell Butte', subdivision: 'Thornburgh' },
  { city: 'Powell Butte', subdivision: 'Tribute' },
  // Sisters
  { city: 'Sisters', subdivision: 'Black Butte Ranch' },
  { city: 'Sisters', subdivision: 'Aspen Lakes' },
  { city: 'Sisters', subdivision: 'Suttle Lake Lodge' },
  // Redmond
  { city: 'Redmond', subdivision: 'Eagle Crest Resort' },
  { city: 'Redmond', subdivision: 'Greens at Redmond' },
  // Terrebonne and Prineville
  { city: 'Terrebonne', subdivision: 'Crooked River Ranch' },
  { city: 'Prineville', subdivision: 'Crooked River Ranch' },
  { city: 'Terrebonne', subdivision: 'Three Rivers Recreation Area' },
  // Warm Springs
  { city: 'Warm Springs', subdivision: 'Kah-Nee-Ta Hot Springs Resort' },
  // Eastern Oregon
  { city: 'Seneca', subdivision: 'Silvies Valley Ranch' },
  { city: 'Pendleton', subdivision: 'Wildhorse Resort' },
  // Southern Oregon — Klamath Falls
  { city: 'Klamath Falls', subdivision: 'Running Y Ranch' },
  // Medford and Rogue Valley
  { city: 'Medford', subdivision: 'Rogue Valley CC' },
  { city: 'Medford', subdivision: 'Centennial GC' },
  { city: 'Medford', subdivision: 'Quail Point' },
  { city: 'Medford', subdivision: 'Bear Creek' },
  { city: 'Medford', subdivision: 'Stewart Meadows' },
  { city: 'Eagle Point', subdivision: 'Eagle Point GC' },
  { city: 'Medford', subdivision: 'Quail Run' },
  { city: 'Medford', subdivision: 'Stone Ridge' },
  { city: 'Medford', subdivision: 'Poppy Village' },
  // Grants Pass
  { city: 'Grants Pass', subdivision: 'Dutcher Creek' },
  { city: 'Grants Pass', subdivision: 'Grants Pass GC' },
  { city: 'Grants Pass', subdivision: 'Applegate GC' },
  { city: 'Grants Pass', subdivision: 'Shadow Hills' },
  // Coast — North
  { city: 'Gearhart', subdivision: 'Gearhart Golf Links' },
  { city: 'Highlands', subdivision: 'Highlands GC' },
  { city: 'Manzanita', subdivision: 'Manzanita GC' },
  { city: 'Seaside', subdivision: 'Seaside GC' },
  // Coast — Central
  { city: 'Gleneden Beach', subdivision: 'Salishan Coastal Lodge' },
  { city: 'Lincoln City', subdivision: 'Chinook Winds' },
  { city: 'Waldport', subdivision: 'Crestview' },
  { city: 'Waldport', subdivision: 'Fairway Villas' },
  // Coast — South
  { city: 'Florence', subdivision: 'Ocean Dunes' },
  { city: 'Florence', subdivision: 'Three Rivers Casino' },
  { city: 'Bandon', subdivision: 'Bandon Dunes' },
  // Mt. Hood and Gorge
  { city: 'Welches', subdivision: 'Mt. Hood Oregon Resort' },
  { city: 'Gresham', subdivision: 'Persimmon CC' },
  { city: 'Hood River', subdivision: 'Cooper Spur' },
  { city: 'Hood River', subdivision: 'Hood River GC' },
  // Portland Metro
  { city: 'Portland', subdivision: 'Rock Creek CC' },
  { city: 'North Plains', subdivision: 'Pumpkin Ridge' },
  { city: 'Portland', subdivision: 'The Reserve' },
  { city: 'Tualatin', subdivision: 'Tualatin CC' },
  { city: 'Lake Oswego', subdivision: 'Lake Oswego CC' },
  { city: 'West Linn', subdivision: 'Oregon GC' },
  { city: 'Lake Oswego', subdivision: 'Claremont' },
  { city: 'Lake Oswego', subdivision: 'Oswego Lake CC' },
  { city: 'Portland', subdivision: 'Heron Lakes' },
  { city: 'Portland', subdivision: 'Portland GC' },
  // Willamette Valley
  { city: 'Creswell', subdivision: 'Emerald Valley' },
  { city: 'Junction City', subdivision: 'Shadow Hills CC' },
  { city: 'Corvallis', subdivision: 'Trysting Tree' },
  { city: 'Stayton', subdivision: 'Santiam' },
  { city: 'Keizer', subdivision: 'McNary' },
  { city: 'Salem', subdivision: 'Creekside' },
  { city: 'Salem', subdivision: 'Illahe Hills' },
  { city: 'Salem', subdivision: 'Salem GC' },
]

export const RESORT_ENTITY_KEYS = new Set(
  RESORT_CITY_SUBDIVISIONS.map(({ city, subdivision }) => subdivisionEntityKey(city, subdivision))
)

/**
 * Check if a city:subdivision is a resort community.
 * When resortKeysFromDb is provided (from getResortEntityKeys()), those take precedence;
 * otherwise falls back to the hardcoded RESORT_ENTITY_KEYS list.
 */
export function isResortCommunity(
  city: string,
  subdivision: string,
  resortKeysFromDb?: Set<string> | null
): boolean {
  const key = subdivisionEntityKey(city, subdivision)
  if (resortKeysFromDb != null && resortKeysFromDb.size > 0) {
    return resortKeysFromDb.has(key)
  }
  return RESORT_ENTITY_KEYS.has(key)
}

/** All resort city/subdivision pairs for admin or cross-reference with SPARK. */
export const RESORT_LIST = RESORT_CITY_SUBDIVISIONS
