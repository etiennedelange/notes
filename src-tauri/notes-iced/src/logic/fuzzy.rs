//! Port of `src/fuzzy.ts`. TODO(unit 1): port scoring and tests; this stub
//! only does a case-insensitive substring check.

#[derive(Debug, Clone, PartialEq)]
pub struct FuzzyMatch {
    pub score: f64,
    /// Char indices into the target that matched, for highlighting.
    pub indices: Vec<usize>,
}

pub fn fuzzy_match(query: &str, target: &str) -> Option<FuzzyMatch> {
    let t = target.to_lowercase();
    let q = query.to_lowercase();
    let start = t.find(&q)?;
    let start = t[..start].chars().count();
    Some(FuzzyMatch {
        score: 0.0,
        indices: (start..start + q.chars().count()).collect(),
    })
}

/// Filters and sorts `items` best-first by matching `query` against `key(item)`.
pub fn fuzzy_filter<'a, T>(
    query: &str,
    items: &'a [T],
    key: impl Fn(&T) -> String,
) -> Vec<(&'a T, FuzzyMatch)> {
    let mut out: Vec<_> = items
        .iter()
        .filter_map(|it| fuzzy_match(query, &key(it)).map(|m| (it, m)))
        .collect();
    out.sort_by(|a, b| b.1.score.total_cmp(&a.1.score));
    out
}
