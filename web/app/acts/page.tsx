import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "กฎหมายแม่บททั้งหมด — กฎหมายเชื่อมโยง",
  description: "ทะเบียนพระราชบัญญัติ พระราชกำหนด และประมวลกฎหมายไทยทั้งหมด พร้อมจำนวนกฎหมายลำดับรองที่เชื่อมโยง",
};

const ACT_TYPES = [
  "พระราชบัญญัติ",
  "พระราชกำหนด",
  "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "ประมวลกฎหมาย",
  "รัฐธรรมนูญ",
];

const PER_PAGE = 50;

export default async function ActsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim();
  const actType = (sp.type ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    ...(query ? { fullName: { contains: query } } : {}),
    ...(actType ? { actType } : {}),
  };

  const [total, acts, typeCounts] = await Promise.all([
    prisma.act.count({ where }),
    prisma.act.findMany({
      where,
      include: { _count: { select: { entries: true } } },
      orderBy: { entries: { _count: "desc" } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.act.groupBy({ by: ["actType"], _count: true }),
  ]);
  const countByType = new Map(typeCounts.map((t) => [t.actType, t._count]));
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageUrl = (p: number) =>
    `/acts?q=${encodeURIComponent(query)}&type=${encodeURIComponent(actType)}&page=${p}`;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">กฎหมายแม่บททั้งหมด</h1>
        <p className="text-sm text-slate-500">
          ทะเบียนนี้สร้างอัตโนมัติจากประกาศในราชกิจจานุเบกษาและการอ้างอิงในกฎหมายลำดับรอง —
          ไม่ต้องคัดกรองล่วงหน้า
        </p>
      </header>

      <form className="space-y-3">
        <input type="hidden" name="type" value={actType} />
        <div className="flex max-w-xl gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="กรองตามชื่อกฎหมาย เช่น ภาษี, แรงงาน..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="submit" className="rounded-lg bg-slate-900 text-white px-5 py-2 hover:bg-slate-700">
            กรอง
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/acts?q=${encodeURIComponent(query)}`}
            className={`rounded-full border px-3 py-1 ${!actType ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}
          >
            ทุกประเภท
          </Link>
          {ACT_TYPES.filter((t) => countByType.has(t)).map((t) => (
            <Link
              key={t}
              href={`/acts?q=${encodeURIComponent(query)}&type=${encodeURIComponent(t)}`}
              className={`rounded-full border px-3 py-1 ${actType === t ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            >
              {t} <span className="text-slate-400">({countByType.get(t)})</span>
            </Link>
          ))}
        </div>
      </form>

      <p className="text-sm text-slate-500">
        พบ {total.toLocaleString("th-TH")} รายการ เรียงตามจำนวนฉบับที่เชื่อมโยง
        {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
        {" — "}
        มองหากฎกระทรวง ประกาศ หรือระเบียบโดยเฉพาะ?{" "}
        <Link href={`/entries${query ? `?q=${encodeURIComponent(query)}` : ""}`} className="text-amber-700 hover:underline">
          ดูทะเบียนกฎหมายลำดับรองที่นี่ →
        </Link>
      </p>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {acts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/act/${a.id}`}
              className="flex items-baseline justify-between gap-4 p-4 hover:bg-amber-50"
            >
              <span className="font-medium leading-snug">{a.fullName}</span>
              <span className="shrink-0 text-sm text-slate-500">
                {a._count.entries.toLocaleString("th-TH")} ฉบับ
              </span>
            </Link>
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
    </div>
  );
}
