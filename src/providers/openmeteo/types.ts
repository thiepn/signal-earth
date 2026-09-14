export interface OpenMeteoCurrentRaw {
  time?: string;
  temperature_2m?: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  weather_code?: number;
  cloud_cover?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
}

export interface OpenMeteoRaw {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  current?: OpenMeteoCurrentRaw;
}
