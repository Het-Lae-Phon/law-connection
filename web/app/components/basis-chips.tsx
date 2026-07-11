import Link from "next/link";

/**
 * BasisChips — the "ออกตามมาตราไหน" property, written explicitly on every
 * sub-regulation row: each authorising section from GazetteEntry.legalBasis
 * becomes a small labelled chip (e.g. [ออกตาม] [มาตรา ๔ วรรคสาม] [มาตรา ๕]).
 *
 * When `sectionsHref` is set (the parent act has structured section data via
 * the thai-law SDK) each chip links to that มาตรา's text at
 * `<sectionsHref>#ม-<n>`.
 */
const SECTION_NO_RE = /มาตรา\s*([๐-๙0-9]+(?:\/[๐-๙0-9]+)?)/;
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function arabic(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
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
        const num = sectionsHref ? SECTION_NO_RE.exec(s)?.[1] : undefined;
        return num ? (
          <Link
            key={s}
            href={`${sectionsHref}#ม-${arabic(num)}`}
            className={`${chipCls} hover:bg-seal-100 hover:underline`}
            title="อ่านตัวบทมาตรานี้"
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
