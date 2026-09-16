export interface FuzzyMatch {
  score: number;
  indices: number[];
}

/**
 * Subsequence fuzzy match, weighted toward consecutive runs, word-boundary
 * starts, and matches close to the start of the string — the same shape as
 * VS Code / Sublime's Ctrl+P ranking, without a dependency.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (query.length === 0) return { score: 0, indices: [] };

  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const indices: number[] = [];

  let qi = 0;
  let score = 0;
  let prevIndex = -1;
  let consecutiveRun = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;

    indices.push(ti);

    const isConsecutive = ti === prevIndex + 1;
    const isWordStart = ti === 0 || /[\s/\\._-]/.test(t[ti - 1]);

    consecutiveRun = isConsecutive ? consecutiveRun + 1 : 1;
    score += 10;
    score += consecutiveRun * 4;
    if (isWordStart) score += 12;
    score -= ti * 0.05;

    prevIndex = ti;
    qi++;
  }

  if (qi !== q.length) return null;

  score -= (target.length - query.length) * 0.1;
  return { score, indices };
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getText: (item: T) => string,
): Array<{ item: T; match: FuzzyMatch }> {
  if (query.trim().length === 0) {
    return items.map((item) => ({ item, match: { score: 0, indices: [] } }));
  }
  const results: Array<{ item: T; match: FuzzyMatch }> = [];
  for (const item of items) {
    const match = fuzzyMatch(query, getText(item));
    if (match) results.push({ item, match });
  }
  results.sort((a, b) => b.match.score - a.match.score);
  return results;
}
