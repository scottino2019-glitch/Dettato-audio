export type SegmentationMode = 'words' | 'commas' | 'sentences' | 'lines';

export interface ParsedItem {
  id: string;
  text: string;
  repeatCount: number;
}

export function parseTextIntoSegments(
  text: string,
  mode: SegmentationMode = 'commas',
  defaultReps = 2,
  lang = 'it'
): ParsedItem[] {
  if (!text || !text.trim()) {
    return [];
  }

  const trimmed = text.trim();
  let rawList: string[] = [];

  if (mode === 'lines') {
    rawList = trimmed
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } else if (mode === 'sentences') {
    // Split by sentence terminators in European, Slavic, and Asian scripts
    rawList = trimmed
      .split(/(?<=[.!?。！？…])\s+|\r?\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else if (mode === 'commas') {
    // Split by commas, semicolons, Asian comma '、' '，', and newlines
    rawList = trimmed
      .split(/[,;:\n\r，、；：]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  } else {
    // Mode 'words'
    // Check if script is East Asian without spaces (Chinese, Japanese)
    const isAsianNoSpace = /^(zh|ja|th)/.test(lang);
    if (isAsianNoSpace) {
      // Split by Asian punctuation or spaces
      rawList = trimmed
        .split(/[,;.!?\s\n\r，、；：。！？]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
    } else {
      // Split by spaces, newlines, commas, quotes
      rawList = trimmed
        .split(/[\s,;:.!?«»"“”()–—\/\n\r]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0 && !/^[-_—*#+]+$/.test(w));
    }
  }

  return rawList.map((item, idx) => ({
    id: `item-${idx}-${item}`,
    text: item,
    repeatCount: defaultReps,
  }));
}
