/**
 * Deschutes County (unincorporated) zone profiles for the CMA zoning explainer.
 * Split out of lib/cma/zoning-explainer.ts to hold the per-file size budget.
 *
 * PRIMARY-SOURCE VERIFICATION (2026-07-30): DCC 18.16.010/.020/.030/.065 (EFU),
 * 18.32.010/.020/.030/.040/.050 (MUA-10), 18.36.010/.050/.090 (F-1),
 * 18.40.010/.050/.090 (F-2), 18.60.010/.020/.030/.040/.050/.060 (RR-10),
 * 19.12.010/.020/.040/.050 (UAR-10), 19.20.010/.020/.030/.040/.050/.055
 * (SR-2 1/2), plus ORS 215.780(1). Read verbatim at
 * deschutescounty.municipalcodeonline.com and oregon.public.law.
 *
 * The use lists are the PRINCIPAL residential and residentially-relevant uses.
 * The cited section is the governing list.
 */
import type { ZoneProfile } from '@/lib/cma/zoning-types'

const DC_URL = 'https://deschutescounty.municipalcodeonline.com'

export const COUNTY_ZONES: Record<string, ZoneProfile> = {
  RR10: {
    zoneName: 'Rural Residential RR-10',
    purpose:
      'The Rural Residential zone exists to provide rural residential living environments, to set standards for rural land use consistent with rural character and the capability of the land, to manage the extension of public services, and to balance community growth against individual property rights.',
    permittedOutright: [
      'A single-unit dwelling, or a manufactured dwelling under DCC 18.116.070',
      'A residential accessory dwelling unit, subject to DCC 18.116.355',
      'A historic home accessory dwelling unit, subject to DCC 18.116.350',
      'Agricultural use',
      'Noncommercial horse stables, and horse events within stated rider limits',
      'Type 1 home occupation',
      'Utility facilities serving the area',
      'Community center shown on the original plat',
      'Temporary hardship dwelling, subject to DCC 18.116.090',
    ],
    conditional: [
      'Golf course',
      'Bed and breakfast inn',
      'Dude ranch',
      'Public park, playground, or recreation facility',
      'Type 2 or Type 3 home occupation',
      'Private or public school',
      'Commercial horse stables',
      'Personal use landing strip',
      'Religious institutions or assemblies',
      'Destination resorts, subject to the DR zone standards',
    ],
    dimensional: [
      { label: 'Minimum lot area', value: '10 acres' },
      { label: 'Maximum lot coverage', value: '30 percent of the lot area' },
      { label: 'Maximum structure height', value: '30 ft' },
      {
        label: 'Front setback',
        value: '20 ft from a local street, 30 ft from a collector, 50 ft from an arterial',
      },
      { label: 'Side setback', value: '10 ft' },
      { label: 'Rear setback', value: '20 ft' },
      { label: 'Setback from ordinary high water mark', value: '100 ft for structures and for septic installations' },
    ],
    citation: 'Deschutes County Code 18.60.010, 18.60.020, 18.60.030, 18.60.040, 18.60.050, 18.60.060',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_18.60_RURAL_RESIDENTIAL_ZONE%3B_RR-10`,
  },
  MUA10: {
    zoneName: 'Multiple Use Agricultural MUA-10',
    purpose:
      'The Multiple Use Agricultural zone exists to preserve rural character while permitting development consistent with that character and with the capacity of the area\'s natural resources, to maintain agricultural lands not suited to full-time commercial farming for part-time agricultural use, to conserve open space and scenic resources, and to provide an orderly transition from rural to urban land use.',
    permittedOutright: [
      'A single-unit dwelling, or a manufactured dwelling under DCC 18.116.070',
      'A residential accessory dwelling unit, subject to DCC 18.116.355',
      'A historic accessory dwelling unit, subject to DCC 18.116.350',
      'Agricultural uses',
      'Propagation or harvesting of a forest product',
      'Noncommercial horse stables, and horse events within stated rider limits',
      'Type 1 home occupation',
      'Temporary hardship dwelling, subject to DCC 18.116.090',
    ],
    conditional: [
      'Destination resorts, subject to the DR zone standards',
      'Public park, playground, or community center',
      'Type 2 or Type 3 home occupation',
      'Private or public school',
      'Commercial horse stables',
      'Bed and breakfast inn',
      'Golf course',
      'Religious institutions or assemblies',
    ],
    dimensional: [
      { label: 'Minimum lot area', value: '10 acres' },
      { label: 'Minimum lot width', value: '150 ft, with 50 ft of street frontage' },
      { label: 'Maximum structure height', value: '30 ft' },
      {
        label: 'Front setback',
        value: '20 ft from a local street, 30 ft from a collector, 80 ft from an arterial',
      },
      {
        label: 'Side setback',
        value: '20 ft, reduced to 10 ft on a lot of a half acre or less created before November 1, 1979. 100 ft where the lot abuts land in farm-use special assessment',
      },
      { label: 'Rear setback', value: '25 ft' },
    ],
    citation: 'Deschutes County Code 18.32.010, 18.32.020, 18.32.030, 18.32.040, 18.32.050',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_18.32_MULTIPLE_USE_AGRICULTURAL_ZONE%3B_MUA`,
  },
  UAR10: {
    zoneName: 'Urban Area Reserve UAR-10',
    purpose:
      'The county\'s Urban Area Reserve zone serves as a holding category and preserves land as useful open space for as long as possible, until it is needed for orderly growth.',
    permittedOutright: [
      'A single-unit dwelling',
      'A residential accessory dwelling unit, subject to DCC 19.92.160',
      'A historic home accessory dwelling unit, subject to DCC 19.92.150',
      'Farm uses',
      'Home occupation, subject to DCC 19.88.140',
      'Farm stands, subject to site review',
      'Day care center facilities, subject to site review',
      'Temporary hardship dwelling, subject to DCC 19.88.320',
    ],
    conditional: ['Determined under DCC 19.12.030. Confirm the current list with county planning'],
    dimensional: [
      { label: 'Minimum lot area', value: '10 acres' },
      { label: 'Minimum lot width', value: '300 ft, with 150 ft of street frontage' },
      {
        label: 'Front setback',
        value: '50 ft, reduced to 30 ft on a lot of record under one acre lawfully created before this title',
      },
      { label: 'Side setback', value: '10 ft' },
      { label: 'Rear setback', value: '50 ft' },
      { label: 'Maximum structure height', value: '30 ft' },
    ],
    citation: 'Deschutes County Code 19.12.010, 19.12.020, 19.12.040, 19.12.050',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_19.12_URBAN_AREA_RESERVE_ZONE_UAR-10`,
  },
  'SR2.5': {
    zoneName: 'Suburban Low Density Residential SR-2 1/2',
    purpose:
      'The Suburban Low Density Residential zone exists to encourage, accommodate, maintain, and protect large-lot suburban residential development, in areas served by a permitted community or municipal sewer system or by individual sewage disposal where the soil will accommodate it, and in areas well suited to that kind of development by location and physical character.',
    permittedOutright: [
      'A single-unit dwelling',
      'A residential accessory dwelling unit, subject to DCC 19.92.160',
      'A historic home accessory dwelling unit, subject to DCC 19.92.150',
      'Agriculture, excluding the keeping of livestock',
      'Home occupations, subject to DCC 19.88.140',
      'Child care facility or preschool',
      'Accessory uses and buildings customarily appurtenant to a permitted use',
      'Temporary hardship dwelling, subject to DCC 19.88.320',
    ],
    conditional: [
      'Planned unit development',
      'Keeping of livestock',
      'Public, parochial, and private schools',
      'Parks and recreation facilities, fire stations, libraries, museums',
      'Religious institution or assembly',
      'Kennel or commercial riding stable',
      'Plant nurseries',
      'Community buildings, lodge and fraternal organizations',
    ],
    dimensional: [
      { label: 'Minimum lot area', value: '2.5 acres' },
      { label: 'Minimum lot width', value: '200 ft' },
      { label: 'Front setback', value: '40 ft' },
      { label: 'Side setback', value: '10 ft' },
      { label: 'Rear setback', value: '20 ft' },
      { label: 'Maximum structure height', value: '30 ft' },
    ],
    citation: 'Deschutes County Code 19.20.010, 19.20.020, 19.20.030, 19.20.040, 19.20.050, 19.20.055',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_19.20_SUBURBAN_LOW_DENSITY_RESIDENTIAL_ZONE%3B_SR_2_1%2F2`,
  },
  EFU: {
    zoneName: 'Exclusive Farm Use',
    purpose:
      'The Exclusive Farm Use zones exist to preserve and maintain agricultural lands and to serve as a sanctuary for farm uses. Oregon law backs that up with right-to-farm protections that limit private civil actions against accepted farming practices on this land.',
    permittedOutright: [
      'Farm use, as defined by ORS 215.203',
      'Propagation or harvesting of a forest product',
      'Accessory buildings customarily provided in conjunction with farm use',
      'Alteration, restoration, or replacement of a lawfully established dwelling, under ORS 215.291',
      'Creation, restoration, or enhancement of wetlands',
    ],
    conditional: [
      'Relative farm-assistance dwelling',
      'Nonfarm dwelling on qualifying unsuitable soils',
      'Lot-of-record dwelling on a qualifying pre-existing lot',
      'Farm stands and commercial activities in conjunction with farm use',
      'Other uses listed at DCC 18.16.030. Each carries its own statutory test',
    ],
    dimensional: [
      { label: 'Minimum new parcel, non-rangeland', value: '80 acres, per ORS 215.780(1)(a)' },
      { label: 'Minimum new parcel, designated rangeland', value: '160 acres, per ORS 215.780(1)(b)' },
      {
        label: 'Irrigated land division standard by subzone',
        value: 'Lower Bridge 130 acres, Sisters and Cloverdale 63 acres, Terrebonne 35 acres, Tumalo, Redmond and Bend 23 acres of irrigated land',
      },
    ],
    citation: 'Deschutes County Code 18.16.010, 18.16.020, 18.16.030, 18.16.065; ORS 215.780(1)',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_18.16_EXCLUSIVE_FARM_USE_ZONES`,
  },
  F1: {
    zoneName: 'Forest Use F-1',
    purpose: 'The purpose of the Forest Use zone is to conserve forest lands.',
    permittedOutright: ['Forest operations and forest practices', 'Uses listed at DCC 18.36.020'],
    conditional: [
      'A single-unit dwelling, subject to the standards at DCC 18.36.050',
      'Other uses listed at DCC 18.36.030, each subject to its own approval standards',
    ],
    dimensional: [
      { label: 'Minimum lot area', value: '80 acres' },
      { label: 'Maximum structure height', value: '30 ft' },
      {
        label: 'Smaller land divisions',
        value: 'Only for uses at DCC 18.36.030(D) through (O) approved under DCC 18.36.040, and only at the minimum area the use requires',
      },
    ],
    citation: 'Deschutes County Code 18.36.010, 18.36.050, 18.36.090',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_18.36_FOREST_USE_ZONE%3B_F-1`,
  },
  F2: {
    zoneName: 'Forest Use F-2',
    purpose: 'The purpose of the Forest Use zone is to conserve forest lands.',
    permittedOutright: ['Forest operations and forest practices', 'Uses listed at DCC 18.40.020'],
    conditional: [
      'A single-unit dwelling, subject to the standards at DCC 18.40.050',
      'Other uses listed at DCC 18.40.030, each subject to its own approval standards',
    ],
    dimensional: [
      { label: 'Minimum lot area', value: '80 acres' },
      { label: 'Maximum structure height', value: '30 ft' },
      {
        label: 'Smaller land divisions',
        value: 'Only for uses at DCC 18.40.030(D) through (P) approved under DCC 18.40.040, and only at the minimum area the use requires',
      },
    ],
    citation: 'Deschutes County Code 18.40.010, 18.40.050, 18.40.090',
    url: `${DC_URL}/book/print?type=ordinances&name=CHAPTER_18.40_FOREST_USE_ZONE%3B_F-2`,
  },
}
