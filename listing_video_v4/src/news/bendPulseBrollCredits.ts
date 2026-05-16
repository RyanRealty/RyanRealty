import brollManifest from '../../public/source_clips/bend_pulse/broll/manifest.json';

type MeetingMap = Record<string, { credit: string }>;
type StillsMap = Record<string, { credit: string }>;

const meetings = brollManifest.meeting_recordings as MeetingMap;
const stills = brollManifest.stills as StillsMap;

export function creditForBrollSlug(slug: string): string {
  return meetings[slug]?.credit ?? 'Bend public meeting · city materials';
}

export function creditForStill(slug: string): string {
  return stills[slug]?.credit ?? '';
}
