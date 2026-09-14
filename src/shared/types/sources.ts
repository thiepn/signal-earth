export type ProviderId = 'usgs' | 'eonet' | 'celestrak' | 'swpc' | 'openmeteo' | 'local';

export interface SourceRef {
  id: ProviderId;
  name: string;
  url: string;
  attribution: string;
}
