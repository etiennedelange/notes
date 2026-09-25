//! Port of `src/docStats.ts`. TODO(unit 1): port behaviour and tests.

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DocStats {
    pub chars: usize,
    pub words: usize,
}

pub fn compute(text: &str) -> DocStats {
    DocStats {
        chars: text.chars().count(),
        words: text.split_whitespace().count(),
    }
}
