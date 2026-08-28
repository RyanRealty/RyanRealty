/**
 * What the Field map should hug. A place polygon wins over a loose pin
 * cloud so Redmond does not open at the regional Google default.
 */

export type FieldMapPoint = { lat: number; lng: number }

export type FieldMapFit =
  | { kind: 'polygon'; points: FieldMapPoint[] }
  | { kind: 'pins'; points: FieldMapPoint[] }
  | { kind: 'single'; point: FieldMapPoint }
  | { kind: 'empty' }

export function fieldMapFit(input: {
  polygons: readonly FieldMapPoint[][]
  pins: readonly FieldMapPoint[]
  placePin?: FieldMapPoint | null
}): FieldMapFit {
  const polygonPoints: FieldMapPoint[] = []
  for (const ring of input.polygons) {
    for (const point of ring) {
      if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        polygonPoints.push(point)
      }
    }
  }
  if (polygonPoints.length > 1) return { kind: 'polygon', points: polygonPoints }
  if (polygonPoints.length === 1) return { kind: 'single', point: polygonPoints[0] }

  const pinPoints: FieldMapPoint[] = []
  for (const pin of input.pins) {
    if (Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) pinPoints.push(pin)
  }
  if (input.placePin && Number.isFinite(input.placePin.lat) && Number.isFinite(input.placePin.lng)) {
    pinPoints.push(input.placePin)
  }
  if (pinPoints.length > 1) return { kind: 'pins', points: pinPoints }
  if (pinPoints.length === 1) return { kind: 'single', point: pinPoints[0] }
  return { kind: 'empty' }
}
