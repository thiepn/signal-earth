import type { TemporalType } from '../time/temporal';
import type { Freshness } from './freshness';
import type { ProviderId, SourceRef } from '../../shared/types/sources';

export interface DataSnapshot<T> {
  provider: ProviderId;
  fetchedAt: number;
  sourceUpdatedAt?: number;
  temporalType: TemporalType;
  freshness: Freshness;
  data: T;
}

export interface CachePolicy {
  ttlMs: number;
  staleForMs: number;
}

export interface ProviderAdapter<TRaw, TNormalized> {
  readonly id: ProviderId;
  readonly source: SourceRef;
  readonly temporalType: TemporalType;
  readonly cachePolicy: CachePolicy;

  fetchRaw(signal?: AbortSignal): Promise<TRaw>;
  normalize(raw: TRaw): TNormalized;
  validate(normalized: TNormalized): boolean;
}
