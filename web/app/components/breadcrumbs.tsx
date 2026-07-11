import Link from "next/link";
import { BackLink } from "./back-link";

/**
 * Breadcrumbs — the one navigation strip every page carries:
 *   [← ย้อนกลับ] · หน้าแรก / <trail...> / <current>
 * The back button walks real history (falls back to the parent path), the
 * trail always starts at หน้าแรก, and the last item is the current page.
 */
export interface Crumb {
  label: string;
  href?: string; // omit on the last (current) item
}

export function Breadcrumbs({
  items,
  backFallback,
}: {
  items: Crumb[];
  /** where ← ย้อนกลับ goes when there is no local history; default: parent crumb or / */
  backFallback?: string;
}) {
  const fallback =
    backFallback ?? [...items].reverse().find((c) => c.href)?.href ?? "/";
  return (
    <nav className="text-sm text-stone-500 flex flex-wrap items-center gap-x-1">
      <BackLink fallbackHref={fallback} />
      <span className="mx-1 text-stone-300">·</span>
      <Link href="/" className="hover:underline">
        หน้าแรก
      </Link>
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-x-1">
          <span className="text-stone-300">/</span>
          {c.href ? (
            <Link href={c.href} className="hover:underline">
              {c.label}
            </Link>
          ) : (
            <span className="text-stone-700">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
