import Link from "next/link";
import { Search, CornerDownLeft, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface TypeFilterOption {
  value: string;
  count: number;
  dotClass?: string; // e.g. "bg-type-act" — omit for taxonomies with no color mapping
}

// Shared search + type-facet filter bar, used by both /acts (กฎหมายแม่บท)
// and /entries (กฎหมายลำดับรอง) — same interaction, different taxonomies.
// Built on shadcn primitives (Input, Badge) themed onto the Sarabaan tokens.
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
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          name="q"
          defaultValue={query}
          placeholder={searchPlaceholder}
          className="h-10 pl-8 pr-16"
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query && (
            <Link
              href={clearHref}
              aria-label="ล้างคำค้นหา"
              className="flex size-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </Link>
          )}
          <button
            type="submit"
            aria-label="ค้นหา"
            className="flex size-7 items-center justify-center bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <CornerDownLeft className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.12em] uppercase">
        <Badge
          variant="outline"
          render={<Link href={chipHref("")} />}
          className={!selectedType ? "border-stone-400 bg-stone-100 text-stone-700" : "border-dashed border-stone-300 text-stone-500 hover:bg-stone-50"}
        >
          ทุกประเภท
        </Badge>
        {options.map(({ value, count, dotClass }) => {
          const selected = selectedType === value;
          return (
            <Badge
              key={value}
              variant="outline"
              render={<Link href={chipHref(value)} />}
              className={`gap-1.5 ${selected ? "border-stone-400 bg-stone-100 text-stone-700" : "border-dashed border-stone-300 text-stone-500 hover:bg-stone-50"}`}
            >
              {dotClass && <span className={`size-1.5 rounded-full ${dotClass}`} />}
              {value} ({count.toLocaleString("th-TH")})
            </Badge>
          );
        })}
      </div>
    </form>
  );
}
