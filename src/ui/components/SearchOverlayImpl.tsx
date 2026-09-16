import { useEffect, useMemo, useRef, useState } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { COMMAND_EXAMPLES, parseCommand } from '../../features/search/commands';
import { searchDocuments } from '../../features/search';
import type { ParsedCommand, RankedSearchResult, SearchDocument, SearchResultKind } from '../../features/search/types';

interface SearchOverlayProps {
  open: boolean;
  documents: SearchDocument[];
  onClose(): void;
  onResult(result: RankedSearchResult): void;
  onCommand(command: ParsedCommand): void;
}

const GLYPH: Record<SearchResultKind, string> = {
  earthquake: '◎',
  'natural-event': '▲',
  satellite: '✦',
  'space-weather': '◇',
  location: '⌖',
  city: '⌖',
  country: '◌',
  layer: '◫',
  'satellite-category': '✦',
  'visual-mode': '◐',
  command: '›',
};

function kindLabel(kind: SearchResultKind): string {
  if (kind === 'natural-event') return 'EVENT';
  if (kind === 'satellite-category') return 'ORBIT';
  if (kind === 'visual-mode') return 'MODE';
  return kind.toUpperCase();
}

export function SearchOverlay({ open, documents, onClose, onResult, onCommand }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const parsedCommand = useMemo(() => parseCommand(query), [query]);
  const results = useMemo(() => searchDocuments(documents, query, 12), [documents, query]);
  const commandOffset = parsedCommand ? 1 : 0;
  const itemCount = results.length + commandOffset;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);
  useDialogFocus(open, dialogRef);

  if (!open) return null;

  const executeActive = () => {
    if (parsedCommand && activeIndex === 0) {
      onCommand(parsedCommand);
      return;
    }
    const result = results[activeIndex - commandOffset];
    if (result) onResult(result);
  };

  return (
    <div className="search-layer" role="presentation">
      <button className="search-scrim" type="button" aria-label="Close search" onClick={onClose} tabIndex={-1} />
      <div ref={dialogRef} className="search-dialog search-dialog--phase12" role="dialog" aria-modal="true" aria-label="Search and commands" tabIndex={-1}>
        <div className="search-input-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (itemCount) setActiveIndex((index) => (index + 1) % itemCount);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (itemCount) setActiveIndex((index) => (index - 1 + itemCount) % itemCount);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                executeActive();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Search Earth or type a command…"
            aria-label="Search Signal Earth"
            aria-autocomplete="list"
            aria-controls="signal-earth-search-results"
            aria-activedescendant={itemCount ? `signal-earth-search-option-${activeIndex}` : undefined}
          />
          <button type="button" onClick={onClose}>ESC</button>
        </div>

        <div className="search-context">
          <span>SEARCH + COMMAND · {documents.length.toLocaleString()} INDEXED</span>
          <span>↑↓ navigate · Enter run · / open</span>
        </div>

        {!query.trim() && (
          <div className="command-examples" aria-label="Command examples">
            {COMMAND_EXAMPLES.slice(0, 8).map((example) => (
              <button key={example} type="button" onClick={() => setQuery(example)}>{example}</button>
            ))}
          </div>
        )}

        <div className="search-results" id="signal-earth-search-results" role="listbox">
          {parsedCommand && (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === 0}
              id="signal-earth-search-option-0"
              className={activeIndex === 0 ? 'is-active' : ''}
              onMouseEnter={() => setActiveIndex(0)}
              onClick={() => onCommand(parsedCommand)}
            >
              <span className="search-result-icon search-result-icon--command" aria-hidden="true">›</span>
              <span><strong>{parsedCommand.canonical}</strong><small>{parsedCommand.description}</small></span>
              <span className="search-result-kind">RUN</span>
            </button>
          )}

          {results.map((result, resultIndex) => {
            const index = resultIndex + commandOffset;
            return (
              <button
                key={result.id}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                id={`signal-earth-search-option-${index}`}
                className={activeIndex === index ? 'is-active' : ''}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onResult(result)}
              >
                <span className={`search-result-icon search-result-icon--${result.kind}`} aria-hidden="true">{GLYPH[result.kind]}</span>
                <span><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                <span className="search-result-kind">{kindLabel(result.kind)}</span>
              </button>
            );
          })}

          {query.trim() && !parsedCommand && results.length === 0 && (
            <div className="search-empty">
              <strong>No local match for “{query}”.</strong>
              <span>Search covers loaded signals, satellites, bundled cities, countries, layers and commands. No remote geocoder is used.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
