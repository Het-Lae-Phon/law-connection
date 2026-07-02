import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { EntryActions } from "@/app/components/entry-actions";

export const dynamic = "force-dynamic";

const TYPE_FILTERS = [
  "พระราชบัญญัติ",
  "พระราชกฤษฎีกา",
  "กฎกระทรวง",
  "ประกาศ",
  "ระเบียบ",
  "ข้อบังคับ",
  "คำสั่ง",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const type = (sp.type ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const PER_PAGE = 25;

  const where = {
    ...(query ? { title: { contains: query } } : {}),
    ...(type ? { instrumentType: type } : {}),
  };

  const [matchingActs, total, entries] = query || type
    ? await Promise.all([
        query
          ? prisma.act.findMany({
              where: { fullName: { contains: query } },
              include: { _count: { select: { entries: true } } },
              orderBy: { entries: { _count: "desc" } },
              take: 5,
            })
          : Promise.resolve([]),
        prisma.gazetteEntry.count({ where }),
        prisma.gazetteEntry.findMany({
          where,
          include: { act: true },
          orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
          skip: (page - 1) * PER_PAGE,
          take: PER_PAGE,
        }),
      ])
    : [[], 0, []];

  const totalPages = Math.ceil(total / PER_PAGE);
  const pageUrl = (p: number) =>
    `/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&page=${p}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ค้นหา</h1>
      <form className="space-y-3">
        <div className="flex max-w-2xl gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="ค้นจากชื่อเรื่องในราชกิจจานุเบกษา..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="submit" className="rounded-lg bg-slate-900 text-white px-6 py-2.5 hover:bg-slate-700">
            ค้นหา
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <label
            className={`cursor-pointer rounded-full border px-3 py-1 ${!type ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white"}`}
          >
            <input type="radio" name="type" value="" defaultChecked={!type} className="hidden" />
            ทุกประเภท
          </label>
          {TYPE_FILTERS.map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-full border px-3 py-1 ${type === t ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white"}`}
            >
              <input type="radio" name="type" value={t} defaultChecked={type === t} className="hidden" />
              {t}
            </label>
          ))}
        </div>
      </form>

      {matchingActs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 mb-2">กฎหมายแม่บทที่ตรงกับคำค้น</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {matchingActs.map((a) => (
              <Link
                key={a.id}
                href={`/act/${a.id}`}
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 hover:bg-amber-100"
              >
                <div className="font-semibold leading-snug">{a.fullName}</div>
                <div className="text-sm text-slate-600">
                  {a._count.entries.toLocaleString("th-TH")} ฉบับที่เชื่อมโยง →
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(query || type) && (
        <section className="space-y-3">
          <p className="text-sm text-slate-500">
            พบ {total.toLocaleString("th-TH")} รายการ
            {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
          </p>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {entries.map((e) => (
              <li key={e.id} className="p-4 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="font-medium leading-snug">{e.title}</div>
                  <EntryActions entry={e} />
                </div>
                <div className="text-sm text-slate-500 flex flex-wrap gap-x-3">
                  <span>{formatThaiDate(e.publishedAt)}</span>
                  {e.volume > 0 && (
                    <span>
                      เล่ม {e.volume} ตอนที่ {e.issue} {e.category}
                    </span>
                  )}
                  {e.origin === "krisdika" && <span>ห้องสมุดกฎหมายกฤษฎีกา</span>}
                  {e.origin === "pdpc" && <span>เว็บไซต์ สคส. (PDPC)</span>}
                  {e.act && (
                    <Link href={`/act/${e.act.id}`} className="text-amber-700 hover:underline">
                      ↳ {e.act.fullName}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex gap-2 justify-center text-sm">
              {page > 1 && (
                <Link href={pageUrl(page - 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
                  ← ก่อนหน้า
                </Link>
              )}
              {page < totalPages && (
                <Link href={pageUrl(page + 1)} className="rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100">
                  ถัดไป →
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
