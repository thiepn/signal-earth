import { describe, expect, it } from 'vitest';
import { SwpcProvider } from '../providers/swpc/SwpcProvider';

const provider = new SwpcProvider();

function fixture() {
  return {
    fetchedAt: Date.parse('2026-09-11T22:20:00Z'),
    partial: false,
    unavailableSources: [],
    kpForecast: [
      { time_tag: '2026-09-11T18:00:00', kp: 1, observed: 'observed', noaa_scale: null },
      { time_tag: '2026-09-11T21:00:00', kp: 3, observed: 'estimated', noaa_scale: null },
      { time_tag: '2026-09-12T00:00:00', kp: 5, observed: 'predicted', noaa_scale: 'G1' },
    ],
    scales: {
      '0': {
        DateStamp: '2026-09-11', TimeStamp: '22:03:00',
        G: { Scale: '1', Text: 'minor' }, R: { Scale: '0', Text: 'none' }, S: { Scale: '0', Text: 'none' },
      },
    },
    solarWindSpeed: [{ proton_speed: 415, time_tag: '2026-09-11T22:16:00Z' }],
    solarWindMag: [{ bt: 5, bz_gsm: -4, time_tag: '2026-09-11T22:16:00Z' }],
    alerts: [{ product_id: 'K05A', issue_datetime: '2026-09-11 20:01:00.000', message: 'ALERT: Geomagnetic K-index of 5\nNOAA Scale: G1 - Minor' }],
    aurora: {
      'Observation Time': '2026-09-11T21:57:00Z',
      'Forecast Time': '2026-09-11T22:27:00Z',
      'Data Format': '[Longitude, Latitude, Aurora]',
      coordinates: [[359, 68, 12], [1, -70, 8], [20, 0, 0]],
      type: 'Feature',
    },
  };
}

describe('SwpcProvider', () => {
  it('preserves observed, estimated and predicted Kp semantics', () => {
    const feed = provider.normalize(fixture());
    expect(feed.kp.map((sample) => sample.kind)).toEqual(['observed', 'estimated', 'predicted']);
    expect(feed.kp[2]?.noaaScale).toBe('G1');
    expect(feed.scales?.G.scale).toBe(1);
  });

  it('normalizes current solar wind and UTC alert timestamps', () => {
    const feed = provider.normalize(fixture());
    expect(feed.solarWind?.speedKmS).toBe(415);
    expect(feed.solarWind?.bzGsmNt).toBe(-4);
    expect(feed.messages[0]?.issuedAt).toBe(Date.parse('2026-09-11T20:01:00Z'));
    expect(feed.messages[0]?.kind).toBe('alert');
  });

  it('packs OVATION coordinates and wraps 0..359 longitude into -180..180', () => {
    const feed = provider.normalize(fixture());
    expect(feed.aurora?.pointCount).toBe(3);
    expect(feed.aurora?.coordinates[0]).toBe(-1);
    expect(feed.aurora?.coordinates[1]).toBe(68);
    expect(provider.validate(feed)).toBe(true);
  });
});
