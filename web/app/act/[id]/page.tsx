import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { confirmLink, disputeLink, addComment, suggestEntry, suggestSource } from "@/lib/actions";

// Thai government domains get an "official" badge on source links
function isGovDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".go.th") || host.endsWith(".or.th");
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

const GROUP_ORDER = [
  "พระราชบัญญัติ",
  "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "พระราชกำหนด",
  "พระราชกฤษฎีกา",
  "กฎกระทรวง",
  "กฎ",
  "ประกาศ",
  "ระเบียบ",
  "ข้อบังคับ",
  "ข้อกำหนด",
  "คำสั่ง",
];

const GROUP_LABELS: Record<string, string> = {
  "พระราชบัญญัติ": "พระราชบัญญัติ / ฉบับแก้ไขเพิ่มเติม",
  "พระราชบัญญัติประกอบรัฐธรรมนูญ": "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "พระราชกำหนด": "พระราชกำหนด",
  "พระราชกฤษฎีกา": "พระราชกฤษฎีกา",
  "กฎกระทรวง": "กฎกระทรวง",
  "กฎ": "กฎ (ก.พ. / ก.ตร. / อื่น ๆ)",
  "ประกาศ": "ประกาศ",
  "ระเบียบ": "ระเบียบ",
  "ข้อบังคับ": "ข้อบังคับ",
  "ข้อกำหนด": "ข้อกำหนด",
  "คำสั่ง": "คำสั่ง",
};

function VerifyBadge({ status, source }: { status: string; source: string | null }) {
  if (status === "verified")
    return (
      <span className="inline-block rounded bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
        ✓ ยืนยันโดยชุมชนแล้ว
      </span>
    );
  if (status === "disputed")
    return (
      <span className="inline-block rounded bg-red-100 text-red-800 text-xs px-1.5 py-0.5">
        ⚠ มีข้อโต้แย้ง — รอตรวจสอบ
      </span>
    );
  const how = source === "pdf" ? "จากเนื้อหา PDF" : source === "title" ? "จากชื่อเรื่อง" : "";
  return (
    <span
      className="inline-block rounded bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5"
      title="สร้างโดยระบบ ยังไม่ได้รับการยืนยันโดยผู้เชี่ยวชาญ"
    >
      ⚙ เชื่อมโยงอัตโนมัติ{how && ` (${how})`}
    </span>
  );
}

const PER_GROUP = 25;
const PER_PAGE = 100;

export default async function ActPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const actId = parseInt(id, 10);
  if (isNaN(actId)) notFound();

  // single-group drilldown view (?type=ประกาศ) — paginated
  const filterType = (sp.type ?? "").trim() || null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const act = await prisma.act.findUnique({
    where: { id: actId },
    include: {
      contributions: {
        where: { type: "comment", status: { not: "rejected" } },
        orderBy: { createdAt: "desc" },
      },
      sources: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!act) notFound();

  const [typeCounts, subCount, verifiedCount] = await Promise.all([
    prisma.gazetteEntry.groupBy({
      by: ["instrumentType"],
      where: { actId },
      _count: true,
    }),
    prisma.gazetteEntry.count({ where: { actId, isPrimary: false } }),
    prisma.gazetteEntry.count({ where: { actId, verifyStatus: "verified" } }),
  ]);
  const countByType = new Map(typeCounts.map((t) => [t.instrumentType ?? "อื่น ๆ", t._count]));

  const orderedKeys = filterType
    ? [filterType]
    : [
        ...GROUP_ORDER.filter((k) => countByType.has(k)),
        ...[...countByType.keys()].filter((k) => !GROUP_ORDER.includes(k)),
      ];

  // fetch entries per group (limited), or one paginated group in drilldown mode
  const groups = new Map<string, Awaited<ReturnType<typeof prisma.gazetteEntry.findMany>>>();
  for (const key of orderedKeys) {
    const list = await prisma.gazetteEntry.findMany({
      where: { actId, instrumentType: key === "อื่น ๆ" ? null : key },
      orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
      take: filterType ? PER_PAGE : PER_GROUP,
      skip: filterType ? (page - 1) * PER_PAGE : 0,
    });
    if (list.length) groups.set(key, list);
  }

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          หน้าแรก
        </Link>{" "}
        /{" "}
        <Link href="/acts" className="hover:underline">
          กฎหมายแม่บท
        </Link>{" "}
        / <span className="text-slate-700">{act.shortName}</span>
      </nav>

      <header className="space-y-2">
        <div className="text-sm font-medium text-amber-700">{act.actType}</div>
        <h1 className="text-2xl font-bold leading-snug">{act.fullName}</h1>
        <p className="text-slate-500 text-sm">
          กฎหมายลำดับรองและฉบับที่เกี่ยวข้องในระบบ {subCount.toLocaleString("th-TH")} ฉบับ
          {verifiedCount > 0 && ` · ยืนยันโดยชุมชนแล้ว ${verifiedCount.toLocaleString("th-TH")} ฉบับ`}{" "}
          (จากราชกิจจานุเบกษาและห้องสมุดกฎหมายกฤษฎีกา)
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-bold">
          แหล่งอ้างอิงทางการ{" "}
          <span className="text-sm font-normal text-slate-400">
            {act.sources.length.toLocaleString("th-TH")} แหล่ง
          </span>
        </h2>
        {act.sources.length === 0 && (
          <p className="text-sm text-slate-500">
            ยังไม่มีแหล่งอ้างอิง — ช่วยเพิ่มลิงก์ฉบับเต็ม/ฉบับปรับปรุงจากแหล่งทางการ เช่น
            สำนักงานคณะกรรมการกฤษฎีกา (krisdika.go.th), ระบบกลางทางกฎหมาย (law.go.th)
            เพื่อให้ผู้อื่นตรวจสอบความถูกต้องได้ง่ายขึ้น
          </p>
        )}
        {act.sources.length > 0 && (
          <ul className="space-y-2">
            {act.sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-amber-800 hover:underline"
                >
                  {s.title} ↗
                </a>
                {isGovDomain(s.url) && (
                  <span className="rounded bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
                    เว็บไซต์หน่วยงานรัฐ
                  </span>
                )}
                {s.publisher && <span className="text-slate-500">{s.publisher}</span>}
                <span className="text-xs text-slate-400">
                  เพิ่มโดย {s.contributor || "ไม่ระบุชื่อ"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-sm text-amber-700 hover:underline">
            + เสนอแหล่งอ้างอิง
          </summary>
          <form action={suggestSource} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="actId" value={act.id} />
            <input
              name="title"
              required
              placeholder="ชื่อแหล่ง เช่น ฉบับปรับปรุงล่าสุด (กฤษฎีกา) *"
              className="rounded border border-slate-300 p-2 text-sm"
            />
            <input
              name="url"
              type="url"
              required
              placeholder="https://... *"
              className="rounded border border-slate-300 p-2 text-sm"
            />
            <input
              name="publisher"
              placeholder="หน่วยงานผู้เผยแพร่ (ไม่บังคับ)"
              className="rounded border border-slate-300 p-2 text-sm"
            />
            <input
              name="contributor"
              placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
              className="rounded border border-slate-300 p-2 text-sm"
            />
            <button className="rounded bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-700 justify-self-start">
              ส่งเข้าคิวตรวจสอบ
            </button>
          </form>
        </details>
      </section>

      {groups.size === 0 && (
        <p className="text-slate-500">
          ยังไม่มีประกาศที่เชื่อมโยงกับกฎหมายฉบับนี้ในช่วงข้อมูลที่มี
        </p>
      )}

      {filterType && (
        <p className="text-sm">
          <Link href={`/act/${act.id}`} className="text-amber-700 hover:underline">
            ← กลับไปหน้ารวมทุกประเภท
          </Link>
        </p>
      )}

      {orderedKeys.filter((k) => groups.has(k)).map((key) => {
        const list = groups.get(key)!;
        const total = countByType.get(key) ?? list.length;
        const shownAll = filterType ? false : total <= PER_GROUP;
        return (
          <section key={key}>
            <h2 className="text-lg font-bold mb-3 flex items-baseline gap-2">
              {GROUP_LABELS[key] ?? key}
              <span className="text-sm font-normal text-slate-400">
                {total.toLocaleString("th-TH")} ฉบับ
                {!shownAll && !filterType && ` · แสดง ${list.length} รายการล่าสุด`}
                {filterType && ` · หน้า ${page}/${Math.max(1, Math.ceil(total / PER_PAGE))}`}
              </span>
              {!shownAll && !filterType && (
                <Link
                  href={`/act/${act.id}?type=${encodeURIComponent(key)}`}
                  className="text-sm font-normal text-amber-700 hover:underline"
                >
                  ดูทั้งหมด →
                </Link>
              )}
            </h2>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {list.map((e) => (
                <li key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="font-medium leading-snug">
                        {e.title}
                        {e.isAmendment && (
                          <span className="ml-2 inline-block rounded bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 align-middle">
                            ฉบับแก้ไข
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        {formatThaiDate(e.publishedAt)}
                        {e.volume > 0 && ` · เล่ม ${e.volume} ตอนที่ ${e.issue} ${e.category} หน้า ${e.page}`}
                        {e.origin === "krisdika" && " · ห้องสมุดกฎหมาย สำนักงานคณะกรรมการกฤษฎีกา"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <VerifyBadge status={e.verifyStatus} source={e.linkSource} />
                        {e.verifyStatus !== "verified" && (
                          <form action={confirmLink}>
                            <input type="hidden" name="entryId" value={e.id} />
                            <button className="text-xs text-green-700 hover:underline" title="ยืนยันว่าการเชื่อมโยงนี้ถูกต้อง">
                              ✓ ยืนยันว่าถูกต้อง
                            </button>
                          </form>
                        )}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-red-700 hover:underline list-none">
                            ⚠ แจ้งว่าไม่ถูกต้อง
                          </summary>
                          <form
                            action={disputeLink}
                            className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3 w-72"
                          >
                            <input type="hidden" name="entryId" value={e.id} />
                            <textarea
                              name="reason"
                              required
                              placeholder="เหตุผล เช่น ออกตามกฎหมายฉบับอื่น..."
                              className="w-full rounded border border-slate-300 p-2 text-sm"
                              rows={2}
                            />
                            <input
                              name="correctAct"
                              placeholder="กฎหมายแม่บทที่ถูกต้อง (ถ้าทราบ)"
                              className="w-full rounded border border-slate-300 p-2 text-sm"
                            />
                            <input
                              name="contributor"
                              placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
                              className="w-full rounded border border-slate-300 p-2 text-sm"
                            />
                            <button className="rounded bg-red-700 text-white px-3 py-1.5">
                              ส่งข้อโต้แย้ง
                            </button>
                          </form>
                        </details>
                      </div>
                    </div>
                    {e.pdfUrl.startsWith("http") && (
                      <a
                        href={e.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                      >
                        PDF ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {filterType && (
              <div className="flex gap-2 justify-center text-sm mt-4">
                {page > 1 && (
                  <Link
                    href={`/act/${act.id}?type=${encodeURIComponent(key)}&page=${page - 1}`}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100"
                  >
                    ← ก่อนหน้า
                  </Link>
                )}
                {page * PER_PAGE < total && (
                  <Link
                    href={`/act/${act.id}?type=${encodeURIComponent(key)}&page=${page + 1}`}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100"
                  >
                    ถัดไป →
                  </Link>
                )}
              </div>
            )}
          </section>
        );
      })}

      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5 space-y-3">
        <h2 className="font-bold">พบกฎหมายลำดับรองที่ขาดหายไป?</h2>
        <p className="text-sm text-slate-500">
          แจ้งกฎกระทรวง ประกาศ หรือระเบียบที่ออกตามกฎหมายฉบับนี้แต่ไม่ปรากฏในรายการ
          ข้อเสนอจะเข้าคิวตรวจสอบก่อนแสดงผล
        </p>
        <form action={suggestEntry} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="actId" value={act.id} />
          <input
            name="title"
            required
            placeholder="ชื่อเต็มของกฎหมายลำดับรอง *"
            className="rounded border border-slate-300 p-2 text-sm sm:col-span-2"
          />
          <input
            name="pdfUrl"
            placeholder="ลิงก์ PDF ราชกิจจานุเบกษา (ถ้ามี)"
            className="rounded border border-slate-300 p-2 text-sm"
          />
          <input name="date" type="date" className="rounded border border-slate-300 p-2 text-sm" />
          <input
            name="contributor"
            placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
            className="rounded border border-slate-300 p-2 text-sm"
          />
          <button className="rounded bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-700">
            ส่งเข้าคิวตรวจสอบ
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          ความเห็น <span className="text-sm font-normal text-slate-400">{act.contributions.length}</span>
        </h2>
        {act.contributions.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="text-slate-700 whitespace-pre-wrap">{c.comment}</div>
            <div className="text-xs text-slate-400 mt-2">
              {c.contributor || "ไม่ระบุชื่อ"} · {formatThaiDate(c.createdAt)}
            </div>
          </div>
        ))}
        <form action={addComment} className="space-y-2">
          <input type="hidden" name="actId" value={act.id} />
          <textarea
            name="comment"
            required
            placeholder="ข้อสังเกตเกี่ยวกับกฎหมายฉบับนี้ เช่น สถานะการยกเลิก ความเชื่อมโยงที่ควรเพิ่ม..."
            className="w-full rounded border border-slate-300 p-3 text-sm"
            rows={3}
          />
          <div className="flex gap-2">
            <input
              name="contributor"
              placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
              className="flex-1 rounded border border-slate-300 p-2 text-sm"
            />
            <button className="rounded bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-700">
              แสดงความเห็น
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
