import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";

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

export default async function ActPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actId = parseInt(id, 10);
  if (isNaN(actId)) notFound();

  const act = await prisma.act.findUnique({
    where: { id: actId },
    include: { entries: { orderBy: { publishedAt: "desc" } } },
  });
  if (!act) notFound();

  const groups = new Map<string, typeof act.entries>();
  for (const e of act.entries) {
    const key = e.instrumentType ?? "อื่น ๆ";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const orderedKeys = [
    ...GROUP_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !GROUP_ORDER.includes(k)),
  ];

  const subCount = act.entries.filter((e) => !e.isPrimary).length;

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
          (จากราชกิจจานุเบกษา มิ.ย. 2566 – ปัจจุบัน)
        </p>
      </header>

      {act.entries.length === 0 && (
        <p className="text-slate-500">
          ยังไม่มีประกาศที่เชื่อมโยงกับกฎหมายฉบับนี้ในช่วงข้อมูลที่มี
        </p>
      )}

      {orderedKeys.map((key) => {
        const list = groups.get(key)!;
        return (
          <section key={key}>
            <h2 className="text-lg font-bold mb-3 flex items-baseline gap-2">
              {GROUP_LABELS[key] ?? key}
              <span className="text-sm font-normal text-slate-400">
                {list.length.toLocaleString("th-TH")} ฉบับ
              </span>
            </h2>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {list.map((e) => (
                <li key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="font-medium leading-snug">
                        {e.title}
                        {e.isAmendment && (
                          <span className="ml-2 inline-block rounded bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 align-middle">
                            ฉบับแก้ไข
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        {formatThaiDate(e.publishedAt)} · เล่ม {e.volume} ตอนที่ {e.issue}{" "}
                        {e.category} หน้า {e.page}
                      </div>
                    </div>
                    <a
                      href={e.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                    >
                      PDF ↗
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
