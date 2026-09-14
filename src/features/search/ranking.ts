import type { RankedSearchResult, SearchDocument } from './types';

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+.-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const value = Math.min(
        next[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      next[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j < next.length; j += 1) prev[j] = next[j]!;
  }
  return prev[b.length]!;
}

function scoreField(query: string, field: string): number {
  if (!query || !field) return 0;
  if (field === query) return 1200;
  if (field.startsWith(query)) return 900 - Math.min(180, field.length - query.length);
  const words = field.split(' ');
  if (words.some((word) => word === query)) return 800;
  if (words.some((word) => word.startsWith(query))) return 680;
  const position = field.indexOf(query);
  if (position >= 0) return 560 - Math.min(240, position * 12);

  if (query.length >= 3 && query.length <= 20) {
    let best = 0;
    for (const word of words) {
      const distance = editDistance(query, word, 2);
      if (distance <= 2) best = Math.max(best, 380 - distance * 90 - Math.abs(word.length - query.length) * 8);
    }
    return best;
  }
  return 0;
}

function queryTokens(query: string): string[] {
  return normalizeSearchText(query).split(' ').filter(Boolean);
}

export function rankSearchDocuments(documents: SearchDocument[], query: string, limit = 12): RankedSearchResult[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [...documents]
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.title.localeCompare(b.title))
      .slice(0, limit)
      .map((document) => ({ ...document, score: document.priority ?? 0, matches: [] }));
  }
  const tokens = queryTokens(query);
  const results: RankedSearchResult[] = [];

  for (const document of documents) {
    const title = normalizeSearchText(document.title);
    const subtitle = normalizeSearchText(document.subtitle);
    const keywordFields = document.keywords.map(normalizeSearchText);
    const fields = [title, ...keywordFields, subtitle];
    let score = scoreField(normalized, title) + (document.priority ?? 0);
    const matches: string[] = [];
    if (scoreField(normalized, title) > 0) matches.push('title');

    for (const token of tokens) {
      let tokenScore = 0;
      for (const field of fields) tokenScore = Math.max(tokenScore, scoreField(token, field));
      if (tokenScore <= 0) { score = 0; break; }
      score += tokenScore * 0.42;
    }
    for (const keyword of keywordFields) {
      const s = scoreField(normalized, keyword);
      if (s > 0) { score += s * 0.55; matches.push(keyword); }
    }
    const sub = scoreField(normalized, subtitle);
    if (sub > 0) score += sub * 0.18;

    if (score > 0) results.push({ ...document, score, matches });
  }

  return results
    .sort((a, b) => b.score - a.score || (b.priority ?? 0) - (a.priority ?? 0) || a.title.localeCompare(b.title))
    .slice(0, limit);
}
