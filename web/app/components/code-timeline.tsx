import codeTimelines from "@/data/code-timelines.json";

/**
 * Version timeline for the eight ประมวลกฎหมาย.
 *
 * Ordinary acts derive their timeline from the gazette editions we hold, but
 * the codes are amended dozens of times and most amending acts predate our
 * gazette coverage — so that list is misleadingly short. Instead we mirror the
 * official amendment history published by สำนักงานคณะกรรมการกฤษฎีกา (the
 * "ผังการแก้ไข" on searchlaw.ocs.go.th): base act → every amendment by date,
 * each linked to the consolidated text as it stood on that date.
 *
 * Data lives in web/data/code-timelines.json, generated from the OCS
 * getPublicLawDoc `timelines` array (verified 2026-07-10). Edition numbers are
 * annotated only where a footnote citation maps unambiguously to a single
 * amendment in that year — otherwise the row is shown by date alone, exactly as
 * OCS presents it.
 */

interface Amendment {
  date: string | null;
  iso: string;
  edition: number | null;
  year: number;
  docUrl: string | null;
}
interface CodeTimeline {
  lawCode: string;
  fullName: string;
  baseDate: string | null;
  amendmentCount: number;
  currentDocUrl: string | null;
  currentDate: string | null;
  amendments: Amendment[];
}

const TIMELINES = codeTimelines as Record<string, CodeTimeline>;

export function codeTimelineFor(shortName: string): CodeTimeline | null {
  return TIMELINES[shortName] ?? null;
}

function Dot({ tone }: { tone: "base" | "amend" | "current" }) {
  const cls =
    tone === "base"
      ? "bg-stone-900 border-stone-900"
      : tone === "current"
        ? "bg-seal-700 border-seal-700"
        : "bg-white border-stone-400";
  return <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border ${cls}`} aria-hidden />;
}

export function CodeTimeline({ data }: { data: CodeTimeline }) {
  const amendments = data.amendments;
  // most recent first is what a lawyer scans for; keep base + current as anchors
  const recent = [...amendments].reverse();

  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="cat-code">VERSION&nbsp;TIMELINE&nbsp;·&nbsp;ผังการแก้ไข</p>
        <span className="text-xs text-stone-400">
          แก้ไขเพิ่มเติม {data.amendmentCount.toLocaleString("th-TH")} ครั้ง (ตามสารบบ สคก.)
        </span>
      </div>

      <ol className="relative ml-2 border-l border-dashed border-stone-300 space-y-3">
        {/* current consolidated text — the version a lawyer usually wants */}
        {data.currentDocUrl && (
          <li className="relative pl-5">
            <Dot tone="current" />
            <div className="text-xs font-semibold text-seal-800">ฉบับปรับปรุงล่าสุด</div>
            <a
              href={data.currentDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:text-seal-700 hover:underline"
            >
              {data.fullName} — ตัวบทปัจจุบัน ↗
            </a>
            {data.currentDate && <div className="text-xs text-stone-400">ปรับปรุง ณ {data.currentDate}</div>}
          </li>
        )}

        {/* amendments, newest first, collapsed past the first few */}
        {recent.length > 0 && (
          <li className="relative pl-5">
            <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full border border-stone-300 bg-white" aria-hidden />
            <details open>
              <summary className="cursor-pointer text-sm text-stone-600 hover:text-stone-800">
                ประวัติการแก้ไขเพิ่มเติม {recent.length.toLocaleString("th-TH")} ครั้ง
              </summary>
              <ol className="mt-3 space-y-3">
                {recent.map((a, i) => (
                  <li key={`${a.iso}-${i}`} className="relative border-l border-dashed border-stone-200 pl-4">
                    <span className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 rounded-full bg-stone-300" aria-hidden />
                    <div className="text-xs text-stone-400">
                      {a.edition ? `แก้ไขเพิ่มเติม (ฉบับที่ ${a.edition.toLocaleString("th-TH")})` : "แก้ไขเพิ่มเติม"}
                    </div>
                    <div className="text-sm">
                      {a.date ?? `พ.ศ. ${a.year.toLocaleString("th-TH")}`}
                      {a.docUrl && (
                        <>
                          {" · "}
                          <a
                            href={a.docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-seal-700 hover:underline"
                          >
                            ดูตัวบท ณ วันที่นี้ ↗
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </li>
        )}

        {/* base act */}
        <li className="relative pl-5">
          <Dot tone="base" />
          <div className="text-xs text-stone-400">ฉบับหลัก</div>
          <div className="text-sm font-medium">{data.fullName}</div>
          {data.baseDate && <div className="text-xs text-stone-400">ประกาศใช้ {data.baseDate}</div>}
        </li>
      </ol>

      <p className="mt-4 text-[11px] text-stone-400">
        ประวัติการแก้ไขและตัวบท ณ แต่ละช่วงเวลา อ้างอิงจากระบบค้นหากฎหมาย สำนักงานคณะกรรมการกฤษฎีกา
        (ผังการแก้ไข) — โปรดยึดฉบับปรับปรุงล่าสุดของหน่วยงานทางการเป็นสำคัญ
      </p>
    </section>
  );
}
