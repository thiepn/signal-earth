import type { EntityId } from './entities';

export type SatelliteCategory =
  | 'stations'
  | 'weather'
  | 'earth-observation'
  | 'navigation'
  | 'science'
  | 'communications';

// Provider-normalized OMM record. It intentionally mirrors the CCSDS/CelesTrak
// JSON field names so it can cross the worker boundary without carrying any
// satellite.js class instances or library-specific objects.
export interface OMMRecord {
  CCSDS_OMM_VERS?: string;
  COMMENT?: string;
  CREATION_DATE?: string;
  ORIGINATOR?: string;
  OBJECT_NAME: string;
  OBJECT_ID?: string;
  CENTER_NAME?: string;
  REF_FRAME?: string;
  TIME_SYSTEM?: string;
  MEAN_ELEMENT_THEORY?: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE?: number;
  CLASSIFICATION_TYPE?: string;
  NORAD_CAT_ID: number | string;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
}

export interface OrbitalObject {
  id: EntityId;
  noradId: string;
  name: string;
  omm: OMMRecord;
  category: SatelliteCategory;
  categories?: SatelliteCategory[];
  epoch: number;
  source: 'celestrak';
}
