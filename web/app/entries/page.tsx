import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { EntryActions } from "@/app/components/entry-actions";
import { TypeFilterForm } from "@/app/components/type-filter-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "กฎหมายลำดับรองทั้งหมด — กฎหมายเชื่อมโยง",
  description: "ทะเบียนกฎกระทรวง ประกาศ ระเบียบ และกฎหมายลำดับรองอื่น ๆ ที่เชื่อมโยงกับกฎหมายแม่บท",
};

const TYPE_FILTERS = [
  "พระราชบัญญัติ",
  "พระราชกฤษฎีกา",
  "กฎกระทรวง",
  "ประกาศ",
  "ระเบียบ",
  "ข้อบังคับ",
  "คำสั่ง",
];

export default async function EntriesPage({
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

  const [total, entries, typeCounts] = await Promise.all([
    prisma.gazetteEntry.count({ where }),
    prisma.gazetteEntry.findMany({
      where,
      include: { act: true },
      orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.gazetteEntry.groupBy({
      by: ["instrumentType"],
      _count: true,
      where: query ? { title: { contains: query } } : undefined,
    }),
  ]);
  const countByType = new Map(typeCounts.map((t) => [t.instrumentType, t._count]));

  const totalPages = Math.ceil(total / PER_PAGE);
  const pageUrl = (p: number) =>
    `/entries?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&page=${p}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">กฎหมายลำดับรองทั้งหมด</h1>
        <p className="text-sm text-stone-500">
          กฎกระทรวง ประกาศ ระเบียบ ข้อบังคับ คำสั่ง ฯลฯ — เรียงตามประกาศล่าสุด มองหารายชื่อพระราชบัญญัติทั้งหมด?{" "}
          <Link href="/acts" className="text-seal-700 hover:underline">
            ดูทะเบียนกฎหมายแม่บท →
          </Link>
        </p>
      </header>

      <TypeFilterForm
        basePath="/entries"
        query={query}
        selectedType={type}
        searchPlaceholder="กรองตามชื่อเรื่องในราชกิจจานุเบกษา..."
        options={TYPE_FILTERS.filter((t) => countByType.has(t)).map((t) => ({
          value: t,
          count: countByType.get(t)!,
        }))}
      />

      <section className="space-y-3">
        <p className="text-sm text-stone-500">
          พบ {total.toLocaleString("th-TH")} รายการ
          {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
        </p>
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {entries.map((e) => (
            <li key={e.id} className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-4">
                <div className="font-medium leading-snug">
                  <Link href={`/entry/${e.id}`} className="hover:text-seal-700 hover:underline">
                    {e.title}
                  </Link>
                </div>
                <EntryActions entry={e} />
              </div>
              <div className="text-sm text-stone-500 flex flex-wrap gap-x-3">
                <span>{formatThaiDate(e.publishedAt)}</span>
                {e.volume > 0 && (
                  <span>
                    เล่ม {e.volume} ตอนที่ {e.issue} {e.category}
                  </span>
                )}
                {e.origin === "krisdika" && <span>ห้องสมุดกฎหมายกฤษฎีกา</span>}
                {e.origin === "pdpc" && <span>เว็บไซต์ สคส. (PDPC)</span>}
                {e.act && (
                  <Link href={`/act/${e.act.id}`} className="text-seal-700 hover:underline">
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
              <Link
                href={pageUrl(page - 1)}
                className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100"
              >
                ← ก่อนหน้า
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageUrl(page + 1)}
                className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100"
              >
                ถัดไป →
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
