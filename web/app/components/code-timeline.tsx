import codeTimelines from "@/data/code-timelines.json";

/**
 * Version timeline for the eight ประมวลกฎหมาย, mirroring the official
 * amendment history from สำนักงานคณะกรรมการกฤษฎีกา (ผังการแก้ไข on
 * searchlaw.ocs.go.th) — see web/data/code-timelines.json.
 *
 * Rendered as a HORIZONTAL rail (newest first) so a 73-amendment code like
 * ประมวลรัษฎากร no longer pushes the rest of the page down: the current
 * consolidated text and the latest amendments are visible immediately and the
 * older history scrolls sideways.
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

function Node({
  dot,
  label,
  labelClass = "text-stone-400",
  children,
}: {
  dot: "current" | "base" | "amend";
  label: string;
  labelClass?: string;
  children: React.ReactNode;
}) {
  const dotCls =
    dot === "current"
      ? "bg-seal-700 border-seal-700"
      : dot === "base"
        ? "bg-stone-900 border-stone-900"
        : "bg-white border-stone-400";
  return (
    <li className="relative w-[168px] shrink-0 snap-start border-t border-dashed border-stone-300 px-3 pt-4 pb-1">
      <span
        className={`absolute left-3 -top-[5px] h-2.5 w-2.5 rounded-full border ${dotCls}`}
        aria-hidden
      />
      <div className={`text-[11px] ${labelClass}`}>{label}</div>
      {children}
    </li>
  );
}

export function CodeTimeline({ data }: { data: CodeTimeline }) {
  // newest first — the reading direction of the rail
  const recent = [...data.amendments].reverse();

  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="cat-code">VERSION&nbsp;TIMELINE&nbsp;·&nbsp;ผังการแก้ไข</p>
        <span className="text-xs text-stone-400">
          แก้ไขเพิ่มเติม {data.amendmentCount.toLocaleString("th-TH")} ครั้ง (ตามสารบบ สคก.) · เลื่อนดูย้อนหลัง →
        </span>
      </div>

      <ol className="flex overflow-x-auto snap-x pb-2 [scrollbar-width:thin]">
        {data.currentDocUrl && (
          <Node dot="current" label="ฉบับปรับปรุงล่าสุด" labelClass="font-semibold text-seal-800">
            <a
              href={data.currentDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium leading-snug hover:text-seal-700 hover:underline"
            >
              ตัวบทปัจจุบัน ↗
            </a>
            {data.currentDate && (
              <div className="text-xs text-stone-400">ณ {data.currentDate}</div>
            )}
          </Node>
        )}

        {recent.map((a, i) => (
          <Node
            key={`${a.iso}-${i}`}
            dot="amend"
            label={a.edition ? `แก้ไขเพิ่มเติม (ฉบับที่ ${a.edition.toLocaleString("th-TH")})` : "แก้ไขเพิ่มเติม"}
          >
            <div className="text-sm leading-snug">{a.date ?? `พ.ศ. ${a.year.toLocaleString("th-TH")}`}</div>
            {a.docUrl && (
              <a
                href={a.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-seal-700 hover:underline"
              >
                ดูตัวบท ณ วันที่นี้ ↗
              </a>
            )}
          </Node>
        ))}

        <Node dot="base" label="ฉบับหลัก">
          <div className="text-sm font-medium leading-snug">{data.fullName}</div>
          {data.baseDate && <div className="text-xs text-stone-400">ประกาศใช้ {data.baseDate}</div>}
        </Node>
      </ol>

      <p className="mt-3 text-[11px] text-stone-400">
        ประวัติการแก้ไขและตัวบท ณ แต่ละช่วงเวลา อ้างอิงจากระบบค้นหากฎหมาย สำนักงานคณะกรรมการกฤษฎีกา
        (ผังการแก้ไข) — โปรดยึดฉบับปรับปรุงล่าสุดของหน่วยงานทางการเป็นสำคัญ
      </p>
    </section>
  );
}
