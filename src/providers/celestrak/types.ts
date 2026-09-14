import type { SatelliteCategory } from '../../shared/types/orbit';

export type CelesTrakRawRecord = Record<string, unknown>;

export interface CelesTrakRawGroup {
  group: string;
  category: SatelliteCategory;
  records: CelesTrakRawRecord[];
}

export interface CelesTrakRawCatalog {
  groups: CelesTrakRawGroup[];
  errors: Array<{ group: string; category: SatelliteCategory; message: string }>;
}
