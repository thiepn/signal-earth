export type IntelligenceTone = 'neutral' | 'watch' | 'high' | 'critical';

export interface IntelligenceFact {
  label: string;
  value: string;
  note?: string;
}

export interface SignalIntelligence {
  eyebrow: string;
  title: string;
  summary: string;
  tone: IntelligenceTone;
  facts: IntelligenceFact[];
  methodology: string;
}
