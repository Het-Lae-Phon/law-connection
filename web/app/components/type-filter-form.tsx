import Link from "next/link";

export interface TypeFilterOption {
  value: string;
  count: number;
  dotClass?: string; // e.g. "bg-type-act" — omit for taxonomies with no color mapping
}

// Shared search + type-facet filter bar, used by both /acts (กฎหมายแม่บท)
// and /entries (กฎหมายลำดับรอง) — same interaction, different taxonomies.
export function TypeFilterForm({
  basePath,
  query,
  selectedType,
  searchPlaceholder,
  options,
}: {
  basePath: string;
  query: string;
  selectedType: string;
  searchPlaceholder: string;
  options: TypeFilterOption[];
}) {
  const chipHref = (type: string) =>
    `${basePath}?q=${encodeURIComponent(query)}${type ? `&type=${encodeURIComponent(type)}` : ""}`;
  const clearHref = `${basePath}${selectedType ? `?type=${encodeURIComponent(selectedType)}` : ""}`;

  return (
    <form className="space-y-3">
      <input type="hidden" name="type" value={selectedType} />
      <div className="relative max-w-xl">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-8 pr-16 focus:outline-none focus:ring-2 focus:ring-seal-500"
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query && (
            <Link
              href={clearHref}
              aria-label="ล้างคำค้นหา"
              className="flex size-7 items-center justify-center text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          )}
          <button
            type="submit"
            aria-label="ค้นหา"
            className="flex size-7 items-center justify-center bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 10l-4 4 4 4M5 14h11a4 4 0 100-8h-1" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.12em] uppercase">
        <Link
          href={chipHref("")}
          className={`border px-2 py-1 ${
            !selectedType ? "border-stone-400 bg-stone-100 text-stone-700" : "border-dashed border-stone-300 text-stone-500 hover:bg-stone-50"
          }`}
        >
          ทุกประเภท
        </Link>
        {options.map(({ value, count, dotClass }) => {
          const selected = selectedType === value;
          return (
            <Link
              key={value}
              href={chipHref(value)}
              className={`inline-flex items-center gap-1.5 border px-2 py-1 ${
                selected ? "border-stone-400 bg-stone-100 text-stone-700" : "border-dashed border-stone-300 text-stone-500 hover:bg-stone-50"
              }`}
            >
              {dotClass && <span className={`size-1.5 rounded-full ${dotClass}`} />}
              {value} ({count.toLocaleString("th-TH")})
            </Link>
          );
        })}
      </div>
    </form>
  );
}
