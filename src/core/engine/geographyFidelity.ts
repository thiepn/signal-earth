export const GEOGRAPHY_DETAIL_PATH = 'data/natural-earth-50m-countries.geojson';
export const GEOGRAPHY_FALLBACK_PATH = 'data/natural-earth-lowres.geojson';

// The base sphere stays smooth regardless of the effects tier. Country and
// coastline shape comes from the untouched 1:50m source vertices; the polygon
// cap curvature only controls interior sphere tessellation, not boundary detail.
export const GLOBE_CURVATURE_DEGREES = 2;
export const LAND_CURVATURE_DEGREES = 5;
