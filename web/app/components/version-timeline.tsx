import Link from "next/link";
import { formatThaiDate } from "@/lib/format";

/**
 * #3 Version timeline of an act — the OCS-style vertical history:
 * ฉบับหลัก → ฉบับแก้ไขเพิ่มเติม (ฉบับที่ n) in chronological order, with
 * repeal (#4) shown as a terminal event. Mark, never delete.
 */

interface TimelineEntry {
  id: number;
  title: string;
  publishedAt: Date | null;
  volume: number;
  issue: string;
  category: string;
  page: number;
  isAmendment: boolean;
}

interface RepealedBy {
  id: number;
  fullName: string;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

// "(ฉบับที่ ๓)" → 3 for ordering when dates are missing
function editionNo(title: string): number {
  const m = title.match(/\(ฉบับที่\s*([๐-๙0-9]+)\)/);
  if (!m) return 1;
  return parseInt(m[1].replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d))), 10);
}

function refLine(e: TimelineEntry): string {
  const parts: string[] = [];
  if (e.publishedAt) parts.push(formatThaiDate(e.publishedAt));
  if (e.volume > 0)
    parts.push(
      `เล่ม ${e.volume} ตอนที่ ${e.issue} ${e.category}${e.page > 0 ? ` หน้า ${e.page}` : ""}`
    );
  return parts.join(" · ");
}

export function VersionTimeline({
  primaries,
  repealedBy,
}: {
  primaries: TimelineEntry[];
  repealedBy: RepealedBy | null;
}) {
  if (primaries.length === 0 && !repealedBy) return null;

  // Krisdika "(ฉบับ Update ณ วันที่ ...)" documents are consolidated copies of
  // the whole act, not amendments — keep them off the main line
  const isConsolidated = (t: string) => /ฉบับ\s*Update|Update\s*ณ\s*วันที่/i.test(t);
  const consolidated = primaries.filter((e) => isConsolidated(e.title));
  const line = primaries.filter((e) => !isConsolidated(e.title));

  const sorted = [...line].sort((a, b) => {
    const ea = editionNo(a.title);
    const eb = editionNo(b.title);
    if (ea !== eb) return ea - eb;
    return (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0);
  });

  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 sm:p-6">
      <p className="cat-code mb-4">VERSION&nbsp;TIMELINE&nbsp;·&nbsp;ประวัติฉบับ</p>
      <ol className="relative ml-2 border-l border-dashed border-stone-300 space-y-4">
        {sorted.map((e, i) => (
          <li key={e.id} className="relative pl-5">
            <span
              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border ${
                i === 0
                  ? "bg-stone-900 border-stone-900"
                  : "bg-white border-stone-400"
              }`}
              aria-hidden
            />
            <div className="text-xs text-stone-400">
              {i === 0
                ? "ฉบับหลัก"
                : editionNo(e.title) > 1
                  ? `ฉบับแก้ไขเพิ่มเติม (ที่ ${editionNo(e.title)})`
                  : "ฉบับแก้ไขเพิ่มเติม"}
            </div>
            <Link href={`/entry/${e.id}`} className="text-sm font-medium leading-snug hover:text-seal-700">
              {e.title}
            </Link>
            <div className="text-xs text-stone-400">{refLine(e)}</div>
          </li>
        ))}

        {repealedBy && (
          <li className="relative pl-5">
            <span
              className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-seal-700 border border-seal-700"
              aria-hidden
            />
            <div className="text-xs font-semibold text-seal-800">ยกเลิก</div>
            <div className="text-sm">
              ถูกยกเลิกโดย{" "}
              <Link href={`/act/${repealedBy.id}`} className="text-seal-700 font-medium hover:underline">
                {repealedBy.fullName}
              </Link>
            </div>
          </li>
        )}
      </ol>
      {consolidated.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-stone-500 hover:text-stone-700">
            สำเนาฉบับปรับปรุงรวมการแก้ไข (Update) {consolidated.length.toLocaleString("th-TH")} ฉบับ
          </summary>
          <ul className="mt-2 ml-2 border-l border-dashed border-stone-200 pl-4 space-y-1.5">
            {consolidated.map((e) => (
              <li key={e.id}>
                <Link href={`/entry/${e.id}`} className="hover:text-seal-700">
                  {e.title}
                </Link>
                <span className="ml-2 text-xs text-stone-400">{refLine(e)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-4 text-[11px] text-stone-400">
        ไทม์ไลน์สร้างอัตโนมัติจากฉบับที่พบในระบบ — ฉบับแก้ไขที่อยู่นอกช่วงข้อมูลอาจไม่ปรากฏ
        โปรดตรวจสอบกับตัวบทฉบับปรับปรุงล่าสุดของหน่วยงานทางการ
      </p>
    </section>
  );
}
