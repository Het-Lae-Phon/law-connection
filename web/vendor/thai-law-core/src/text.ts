import type { Paragraph } from "./types";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** ๒๔ -> "24" (passes through Arabic digits and "/"). */
export function thaiToArabic(s: string): string {
  return [...s]
    .map((c) => {
      const i = THAI_DIGITS.indexOf(c);
      return i >= 0 ? String(i) : c;
    })
    .join("");
}

/** "24" -> ๒๔ */
export function arabicToThai(s: string): string {
  return [...s].map((c) => (/[0-9]/.test(c) ? THAI_DIGITS[Number(c)] : c)).join("");
}

/** Thai ordinal words used in วรรค citations -> number. */
const WAK_WORDS: Record<string, number> = {
  "หนึ่ง": 1, "สอง": 2, "สาม": 3, "สี่": 4, "ห้า": 5, "หก": 6,
  "เจ็ด": 7, "แปด": 8, "เก้า": 9, "สิบ": 10, "สิบเอ็ด": 11, "สิบสอง": 12,
  "ท้าย": -1, // วรรคท้าย = last paragraph
};

export function wakWordToNumber(word: string): number | undefined {
  return WAK_WORDS[word];
}

/** Reading-order plain text of a version's paragraphs. */
export function paragraphsToText(paragraphs: Paragraph[]): string {
  const parts: string[] = [];
  for (const p of paragraphs) {
    parts.push(p.text_th);
    for (const it of p.items ?? []) {
      parts.push(`${it.num_th} ${it.text_th}`);
      for (const s of it.subitems ?? []) parts.push(`${s.num_th} ${s.text_th}`);
    }
  }
  return parts.join("\n");
}
