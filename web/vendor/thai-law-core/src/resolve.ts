/**
 * Pure, browser-safe resolution logic — no Node built-ins.
 * Published as `@thai-law/core/resolve` for web apps that load the data
 * records themselves (e.g. bundled JSON) and only need the legal logic.
 */
import type {
  CitationTarget,
  ProvisionVersion,
  ResolvedSection,
  SectionRecord,
} from "./types";
import { paragraphsToText, thaiToArabic, wakWordToNumber } from "./text";

export * from "./types";
export { thaiToArabic, arabicToThai, paragraphsToText, wakWordToNumber } from "./text";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The version of a provision in force on `asOf`, or undefined. */
export function resolveVersion(
  rec: SectionRecord,
  asOf: string,
): ProvisionVersion | undefined {
  return rec.versions.find(
    (v) => v.valid_from <= asOf && (v.valid_to === null || asOf < v.valid_to),
  );
}

/** A section resolved to a point in time, with rendered plain text. */
export function resolveSection(
  rec: SectionRecord,
  asOf: string = todayISO(),
): ResolvedSection | undefined {
  const version = resolveVersion(rec, asOf);
  if (!version) return undefined;
  return { record: rec, version, text_th: paragraphsToText(version.paragraphs) };
}

export const CITATION_RE =
  /มาตรา\s*([๐-๙0-9]+(?:\/[๐-๙0-9]+)?)\s*(?:วรรค\s*(สิบเอ็ด|สิบสอง|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ท้าย))?\s*(?:\(\s*([๐-๙0-9]+)\s*\))?/;

export interface ParsedCitation {
  /** Arabic section number, e.g. "24" or "22/1" */
  number: string;
  /** วรรค number (1-based; -1 = วรรคท้าย) when the citation names one */
  wak?: number;
  /** (๑)-style item id in Arabic when the citation names one */
  itemId?: string;
}

/** Parse "มาตรา ๑๙ วรรคห้า (๒)"-style citation strings. */
export function parseCitation(citation: string): ParsedCitation | undefined {
  const m = citation.match(CITATION_RE);
  if (!m) return undefined;
  const out: ParsedCitation = { number: thaiToArabic(m[1]) };
  if (m[2]) out.wak = wakWordToNumber(m[2]);
  if (m[3]) out.itemId = thaiToArabic(m[3]);
  return out;
}

/**
 * Resolve a citation against any record source (a Map, an index, a fetch
 * cache) via the `lookup` callback keyed by Arabic section number.
 */
export function resolveCitationWith(
  lookup: (sectionNumber: string) => SectionRecord | undefined,
  citation: string,
  asOf: string = todayISO(),
): CitationTarget | undefined {
  const parsed = parseCitation(citation);
  if (!parsed) return undefined;
  const rec = lookup(parsed.number);
  if (!rec) return undefined;
  const section = resolveSection(rec, asOf);
  if (!section) return undefined;

  const out: CitationTarget = { section };
  if (parsed.wak !== undefined) {
    const paras = section.version.paragraphs;
    out.paragraph = parsed.wak === -1 ? paras[paras.length - 1] : paras[parsed.wak - 1];
  }
  if (parsed.itemId) {
    const inParagraphs = out.paragraph ? [out.paragraph] : section.version.paragraphs;
    for (const p of inParagraphs) {
      const item = (p.items ?? []).find((i) => i.id === parsed.itemId);
      if (item) {
        out.item = item;
        out.paragraph ??= p;
        break;
      }
    }
  }
  return out;
}
