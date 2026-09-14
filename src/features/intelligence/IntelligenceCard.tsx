import type { SignalIntelligence } from './types';

interface IntelligenceCardProps {
  intelligence: SignalIntelligence;
  context?: string | null;
  compact?: boolean;
}

export function IntelligenceCard({ intelligence, context, compact = false }: IntelligenceCardProps) {
  return (
    <section className={`intelligence-card intelligence-card--${intelligence.tone}${compact ? ' intelligence-card--compact' : ''}`}>
      <header className="intelligence-card__header">
        <span>{intelligence.eyebrow}</span>
        <b>DERIVED</b>
      </header>
      <h3>{intelligence.title}</h3>
      <p className="intelligence-card__summary">{intelligence.summary}</p>
      {context && <p className="intelligence-card__context">{context}</p>}
      <div className="intelligence-facts">
        {intelligence.facts.map((fact) => (
          <div key={`${fact.label}:${fact.value}`}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
            {fact.note && <small>{fact.note}</small>}
          </div>
        ))}
      </div>
      <p className="intelligence-card__method">{intelligence.methodology}</p>
    </section>
  );
}
