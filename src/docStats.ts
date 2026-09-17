export interface DocStats {
  chars: number;
  words: number;
}

export function computeDocStats(text: string): DocStats {
  const trimmed = text.trim();
  return {
    chars: text.length,
    words: trimmed === "" ? 0 : trimmed.split(/\s+/).length,
  };
}
