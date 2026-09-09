/**
 * The plat page title. The city segment is dropped when the plat name already
 * ends in the city — "Rock Ridge Cabin Sites of Black Butte Ranch | Black Butte
 * Ranch, Oregon" said the place twice on a 120-character title (SITE-25).
 * A null city says nothing about the city (§0): the layout suffix already
 * carries "Central Oregon" once.
 */
export function platPageTitle(name: string, cityName: string | null): string {
  if (!cityName) return `Homes for Sale in ${name}`
  if (name.toLowerCase().endsWith(cityName.toLowerCase())) return `Homes for Sale in ${name}, Oregon`
  return `Homes for Sale in ${name} | ${cityName}, Oregon`
}
