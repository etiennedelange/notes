//! Port of the pure half of `src/pasteCode.ts`. TODO(unit 1): port the
//! heuristics and tests; these stubs never detect code.

pub fn looks_like_code(_text: &str) -> bool {
    false
}

/// Returns a fence info string such as `"rust"`, or `""` if unsure.
pub fn guess_language(_text: &str) -> &'static str {
    ""
}

pub fn fence_code_block(text: &str) -> String {
    format!("```{}\n{}\n```\n", guess_language(text), text.trim_end_matches('\n'))
}
