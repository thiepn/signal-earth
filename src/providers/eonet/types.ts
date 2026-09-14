export interface EonetCategoryRaw {
  id?: unknown;
  title?: unknown;
}

export interface EonetSourceRaw {
  id?: unknown;
  url?: unknown;
}

export interface EonetGeometryRaw {
  magnitudeValue?: unknown;
  magnitudeUnit?: unknown;
  magnitudeDescription?: unknown;
  date?: unknown;
  type?: unknown;
  coordinates?: unknown;
}

export interface EonetEventRaw {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  link?: unknown;
  closed?: unknown;
  categories?: unknown;
  sources?: unknown;
  geometry?: unknown;
}

export interface EonetResponseRaw {
  title?: unknown;
  description?: unknown;
  link?: unknown;
  events?: unknown;
}

export interface EonetCombinedRaw {
  open: EonetResponseRaw | null;
  recentClosed: EonetResponseRaw | null;
  fetchedAt: number;
  partial: boolean;
}
