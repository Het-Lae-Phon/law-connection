import Link from "next/link";

/**
 * When did the subordinate legislation actually come out? A horizontal rail
 * of year buckets (newest first) under the version timeline — bar height
 * shows relative volume, and each year links to the act page filtered to
 * that year's ประกาศ/กฎกระทรวง.
 */
export interface YearBucket {
  yearBE: number;
  count: number;
}

export function SubRegYearRail({
  actId,
  buckets,
  activeYearBE,
}: {
  actId: number;
  buckets: YearBucket[];
  activeYearBE?: number;
}) {
  if (buckets.length < 2) return null;
  const max = Math.max(...buckets.map((b) => b.count));

  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="cat-code">ISSUANCE&nbsp;TIMELINE&nbsp;·&nbsp;การออกกฎหมายลำดับรอง</p>
        <span className="text-xs text-stone-400">
          {buckets.length.toLocaleString("th-TH")} ปีที่มีการออก · เลื่อนดูย้อนหลัง →
        </span>
      </div>
      <ol className="flex overflow-x-auto snap-x pb-1 [scrollbar-width:thin]">
        {buckets.map((b) => {
          const active = b.yearBE === activeYearBE;
          return (
            <li key={b.yearBE} className="shrink-0 snap-start border-t border-dashed border-stone-300">
              <Link
                href={active ? `/act/${actId}` : `/act/${actId}?year=${b.yearBE}`}
                title={`พ.ศ. ${b.yearBE} — ${b.count.toLocaleString("th-TH")} ฉบับ${active ? " (คลิกเพื่อล้างตัวกรอง)" : ""}`}
                className={`flex h-24 w-[68px] flex-col items-center justify-end gap-1 px-1.5 pb-1 pt-2 text-center hover:bg-seal-50 ${
                  active ? "bg-seal-50" : ""
                }`}
              >
                <span
                  className={`w-4 rounded-sm ${active ? "bg-seal-700" : "bg-stone-300"}`}
                  style={{ height: `${Math.max(6, Math.round((b.count / max) * 44))}px` }}
                  aria-hidden
                />
                <span className={`text-[11px] ${active ? "font-semibold text-seal-800" : "text-stone-600"}`}>
                  {b.yearBE}
                </span>
                <span className="cat-code">{b.count.toLocaleString("th-TH")}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-stone-400">
        นับจากวันประกาศของกฎหมายลำดับรองแต่ละฉบับในระบบ — คลิกปีเพื่อกรองรายการด้านล่าง
      </p>
    </section>
  );
}
