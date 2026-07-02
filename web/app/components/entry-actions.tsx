import Link from "next/link";
import { buildCitation, originalSource, type CitableEntry } from "@/lib/cite";
import { CopyCite } from "@/app/components/copy-cite";

interface Entry extends CitableEntry {
  id: number;
  origin: string;
  sourceUrl?: string | null;
}

/**
 * The action column for a law entry, ordered by the product's two purposes:
 * 1) reference — copy a proper legal citation
 * 2) original source — the authoritative link first; our stored copy is the
 *    clearly-secondary fallback when no public link exists.
 */
export function EntryActions({ entry }: { entry: Entry }) {
  const source = originalSource(entry);
  const hasText = entry.origin === "krisdika"; // library imports carry full text
  return (
    <div className="shrink-0 flex flex-col items-stretch gap-1.5 w-36">
      {source && (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-slate-900 text-white px-3 py-1.5 text-sm text-center hover:bg-slate-700"
          title={`เปิดต้นฉบับ: ${source.url}`}
        >
          ต้นฉบับ · {source.label} ↗
        </a>
      )}
      {!source && hasText && (
        <Link
          href={`/doc/${entry.id}`}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-center hover:bg-slate-100"
          title="สำเนาข้อความสำหรับอ้างอิง — ไม่ใช่ต้นฉบับ"
        >
          สำเนาอ้างอิง
        </Link>
      )}
      <CopyCite citation={buildCitation(entry)} small />
    </div>
  );
}
