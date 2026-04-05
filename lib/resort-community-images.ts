import { subdivisionEntityKey } from '@/lib/slug'

const RESORT_IMAGE_BY_ENTITY_KEY: Record<string, string> = {
  [subdivisionEntityKey('Bend', 'Tetherow')]:
    'https://images.unsplash.com/photo-1501084291732-13b1ba8f0ebc?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Bend', 'Pronghorn')]:
    'https://images.unsplash.com/photo-1510279770292-4b34de9f5c23?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Bend', 'Juniper Preserve')]:
    'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Bend', 'Broken Top')]:
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Sunriver', 'Sunriver')]:
    'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Sunriver', 'Caldera Springs')]:
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Powell Butte', 'Brasada Ranch')]:
    'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Sisters', 'Black Butte Ranch')]:
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Redmond', 'Eagle Crest Resort')]:
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
  [subdivisionEntityKey('Terrebonne', 'Crooked River Ranch')]:
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80',
}

export function getResortCommunityImage(city: string, subdivision: string): string | null {
  const key = subdivisionEntityKey(city, subdivision)
  return RESORT_IMAGE_BY_ENTITY_KEY[key] ?? null
}
