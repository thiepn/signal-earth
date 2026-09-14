import type { ProviderId, SourceRef } from '../../shared/types/sources';

export const SOURCE_REGISTRY: Record<ProviderId, SourceRef> = {
  local: {
    id: 'local',
    name: 'Signal Earth',
    url: '',
    attribution: 'Locally computed or user-selected application state.',
  },
  usgs: {
    id: 'usgs',
    name: 'U.S. Geological Survey',
    url: 'https://earthquake.usgs.gov/',
    attribution: 'Earthquake data courtesy of the U.S. Geological Survey.',
  },
  eonet: {
    id: 'eonet',
    name: 'NASA EONET',
    url: 'https://eonet.gsfc.nasa.gov/',
    attribution: 'Natural event data from NASA Earth Observatory Natural Event Tracker.',
  },
  celestrak: {
    id: 'celestrak',
    name: 'CelesTrak',
    url: 'https://celestrak.org/',
    attribution: 'Orbital element data from CelesTrak, Dr. T.S. Kelso.',
  },
  swpc: {
    id: 'swpc',
    name: 'NOAA Space Weather Prediction Center',
    url: 'https://www.swpc.noaa.gov/',
    attribution: 'Space weather data from NOAA SWPC.',
  },
  openmeteo: {
    id: 'openmeteo',
    name: 'Open-Meteo',
    url: 'https://open-meteo.com/',
    attribution: 'Weather data by Open-Meteo.com.',
  },
};
