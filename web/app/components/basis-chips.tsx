import Link from "next/link";
// the SDK's pure citation parser (no data bundle pulled in) — understands
// "มาตรา ๑๙ วรรคห้า (๒)" including วรรค words and วรรคท้าย
import { parseCitation } from "@/vendor/thai-law-core/src/resolve";

/**
 * BasisChips — the "ออกตามมาตราไหน" property, written explicitly on every
 * sub-regulation row: each authorising section from GazetteEntry.legalBasis
 * becomes a small labelled chip (e.g. [ออกตาม] [มาตรา ๔ วรรคสาม] [มาตรา ๕]).
 *
 * When `sectionsHref` is set (the parent act has structured section data via
 * the thai-law SDK) each chip deep-links to that provision — down to the
 * exact วรรค when the citation names one: `<sectionsHref>#ม-4-ว-3`.
 */
function anchorFor(citation: string): string | null {
  const parsed = parseCitation(citation);
  if (!parsed) return null;
  // วรรคท้าย (-1) can't be numbered without the record — land on the section
  return parsed.wak && parsed.wak > 0
    ? `ม-${parsed.number}-ว-${parsed.wak}`
    : `ม-${parsed.number}`;
}

export function BasisChips({
  legalBasis,
  label = "ออกตาม",
  sectionsHref,
}: {
  legalBasis: string | null | undefined;
  label?: string;
  sectionsHref?: string;
}) {
  if (!legalBasis) return null;
  const sections = legalBasis
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sections.length === 0) return null;
  const chipCls =
    "rounded-sm border border-seal-300 bg-seal-50 px-1.5 py-px text-[11px] leading-tight text-seal-800";
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <span className="cat-code">{label}</span>
      {sections.map((s) => {
        const anchor = sectionsHref ? anchorFor(s) : null;
        return anchor ? (
          <Link
            key={s}
            href={`${sectionsHref}#${anchor}`}
            className={`${chipCls} hover:bg-seal-100 hover:underline`}
            title={anchor.includes("-ว-") ? "อ่านตัวบทวรรคนี้" : "อ่านตัวบทมาตรานี้"}
          >
            {s}
          </Link>
        ) : (
          <span key={s} className={chipCls}>
            {s}
          </span>
        );
      })}
    </span>
  );
}
