/**
 * BasisChips — the "ออกตามมาตราไหน" property, written explicitly on every
 * sub-regulation row: each authorising section from GazetteEntry.legalBasis
 * becomes a small labelled chip (e.g. [ออกตาม] [มาตรา ๔ วรรคสาม] [มาตรา ๕]).
 */
export function BasisChips({
  legalBasis,
  label = "ออกตาม",
}: {
  legalBasis: string | null | undefined;
  label?: string;
}) {
  if (!legalBasis) return null;
  const sections = legalBasis
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sections.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <span className="cat-code">{label}</span>
      {sections.map((s) => (
        <span
          key={s}
          className="rounded-sm border border-seal-300 bg-seal-50 px-1.5 py-px text-[11px] leading-tight text-seal-800"
        >
          {s}
        </span>
      ))}
    </span>
  );
}
