import Link from "next/link";
import { formatThaiDate } from "@/lib/format";

/**
 * Word-tree of an act's subordinate legislation, branched by the authorising
 * section (มาตรา) extracted into GazetteEntry.legalBasis — the actual legal
 * power structure, not just instrument types.
 *
 * Nodes keep the ORIGINAL full title; each leaf carries its reference
 * (gazette citation + date) as a property line. Rendered server-side as
 * nested <details> with the archival dashed-line motif.
 */

interface TreeEntry {
  id: number;
  title: string;
  instrumentType: string | null;
  legalBasis: string | null;
  publishedAt: Date | null;
  volume: number;
  issue: string;
  category: string;
  page: number;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

// normalise a section token so "มาตรา ๔๗  (๗)" and "มาตรา 47 (7)" merge
function normalizeSection(s: string): string {
  return s
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")")
    .trim();
}

// numeric sort key from "มาตรา 47 (7) วรรคสอง" → [47, 7]
function sectionSortKey(sec: string): [number, number] {
  const m = sec.match(/มาตรา\s*(\d+)(?:\/(\d+))?/);
  const main = m ? parseInt(m[1], 10) : 9999;
  const sub = sec.match(/\((\d+)/);
  return [main, sub ? parseInt(sub[1], 10) : 0];
}

function refLine(e: TreeEntry): string {
  const parts: string[] = [];
  if (e.publishedAt) parts.push(formatThaiDate(e.publishedAt));
  if (e.volume > 0)
    parts.push(
      `เล่ม ${e.volume} ตอนที่ ${e.issue} ${e.category}${e.page > 0 ? ` หน้า ${e.page}` : ""}`
    );
  return parts.join(" · ");
}

export function SectionTree({ actName, entries }: { actName: string; entries: TreeEntry[] }) {
  // group by first normalised section; hold the rest of the basis as a note
  const groups = new Map<string, { entries: (TreeEntry & { extraBasis: boolean })[] }>();
  const noBasis: TreeEntry[] = [];
  for (const e of entries) {
    if (!e.legalBasis) {
      noBasis.push(e);
      continue;
    }
    const sections = e.legalBasis.split(",").map((s) => normalizeSection(s));
    const first = sections[0];
    if (!groups.has(first)) groups.set(first, { entries: [] });
    groups.get(first)!.entries.push({ ...e, extraBasis: sections.length > 1 });
  }
  const sorted = [...groups.entries()].sort((a, b) => {
    const [am, as] = sectionSortKey(a[0]);
    const [bm, bs] = sectionSortKey(b[0]);
    return am - bm || as - bs;
  });

  return (
    <div className="space-y-0">
      {/* root node */}
      <div className="flex items-center gap-3">
        <span className="label-metal text-white px-2.5 py-1 text-sm font-semibold [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
          {actName}
        </span>
        <span className="cat-code">
          {sorted.length}&nbsp;มาตรา&nbsp;·&nbsp;{entries.length}&nbsp;ฉบับ
        </span>
      </div>

      <div className="ml-3 border-l border-dashed border-stone-300 pl-5 pt-3 space-y-2">
        {sorted.map(([section, g], i) => (
          <details key={section} open={i < 3} className="group">
            <summary className="cursor-pointer list-none flex items-baseline gap-2 -ml-[26px]">
              <span className="text-stone-300 select-none">──</span>
              <span className="font-semibold text-stone-800 group-open:text-seal-800">
                {section}
              </span>
              <span className="cat-code">{g.entries.length}&nbsp;ฉบับ</span>
            </summary>
            <ul className="ml-2 border-l border-dashed border-stone-200 pl-4 py-1 space-y-2">
              {g.entries.map((e) => (
                <li key={e.id} className="text-sm leading-snug">
                  <Link href={`/entry/${e.id}`} className="hover:text-seal-700">
                    {e.title}
                  </Link>
                  {e.extraBasis && (
                    <span
                      className="ml-1.5 cat-code"
                      title={`อ้างหลายมาตรา: ${e.legalBasis}`}
                    >
                      +มาตราอื่น
                    </span>
                  )}
                  <div className="text-xs text-stone-400">{refLine(e)}</div>
                </li>
              ))}
            </ul>
          </details>
        ))}

        {noBasis.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none flex items-baseline gap-2 -ml-[26px]">
              <span className="text-stone-300 select-none">──</span>
              <span className="text-stone-500">ไม่ระบุมาตรา (เชื่อมโยงจากชื่อเรื่อง)</span>
              <span className="cat-code">{noBasis.length}&nbsp;ฉบับ</span>
            </summary>
            <ul className="ml-2 border-l border-dashed border-stone-200 pl-4 py-1 space-y-2">
              {noBasis.map((e) => (
                <li key={e.id} className="text-sm leading-snug">
                  <Link href={`/entry/${e.id}`} className="hover:text-seal-700">
                    {e.title}
                  </Link>
                  <div className="text-xs text-stone-400">{refLine(e)}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
