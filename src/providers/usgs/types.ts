export interface UsgsGeoJsonCollection {
  type: 'FeatureCollection';
  metadata: {
    generated: number;
    url: string;
    title: string;
    api: string;
    count: number;
    status: number;
  };
  features: UsgsGeoJsonFeature[];
}

export interface UsgsGeoJsonFeature {
  type: 'Feature';
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated: number;
    url: string;
    detail: string;
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: string | null;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    magType: string | null;
    type: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number];
  } | null;
}
