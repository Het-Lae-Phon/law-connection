import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { actTypeStyle } from "@/lib/act-type-colors";
import { TypeFilterForm } from "@/app/components/type-filter-form";
import { Breadcrumbs } from "@/app/components/breadcrumbs";
import { TypeGlyph } from "@/app/components/geo-shape";

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
    prisma.act.groupBy({
      by: ["actType"],
      _count: true,
      where: query ? { fullName: { contains: query } } : undefined,
    }),
  ]);
  const countByType = new Map(typeCounts.map((t) => [t.actType, t._count]));
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageUrl = (p: number) =>
    `/acts?q=${encodeURIComponent(query)}&type=${encodeURIComponent(actType)}&page=${p}`;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "กฎหมายแม่บท" }]} backFallback="/" />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-serif-thai)]">กฎหมายแม่บททั้งหมด</h1>
        <p className="text-sm text-stone-500">
          ทะเบียนนี้สร้างอัตโนมัติจากประกาศในราชกิจจานุเบกษาและการอ้างอิงในกฎหมายลำดับรอง —
          ไม่ต้องคัดกรองล่วงหน้า
        </p>
      </header>

      <TypeFilterForm
        basePath="/acts"
        query={query}
        selectedType={actType}
        searchPlaceholder="กรองตามชื่อกฎหมาย เช่น ภาษี, แรงงาน..."
        options={ACT_TYPES.filter((t) => countByType.has(t)).map((t) => ({
          value: t,
          count: countByType.get(t)!,
          dotClass: actTypeStyle(t).dot,
        }))}
      />

      <p className="text-sm text-stone-500">
        พบ {total.toLocaleString("th-TH")} รายการ เรียงตามจำนวนฉบับที่เชื่อมโยง
        {totalPages > 1 && ` · หน้า ${page}/${totalPages}`}
        {" — "}
        มองหากฎกระทรวง ประกาศ หรือระเบียบโดยเฉพาะ?{" "}
        <Link href={`/entries${query ? `?q=${encodeURIComponent(query)}` : ""}`} className="text-seal-700 hover:underline">
          ดูทะเบียนกฎหมายลำดับรองที่นี่ →
        </Link>
      </p>

      <div>
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 border-b border-stone-300 pb-2 font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.12em] text-stone-400 uppercase">
          <span>/ ประเภท</span>
          <span>/ ชื่อกฎหมาย</span>
          <span>/ ฉบับที่เชื่อมโยง</span>
        </div>
        {acts.map((a) => {
          const style = actTypeStyle(a.actType);
          return (
            <Link
              key={a.id}
              href={`/act/${a.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rule-dashed py-5 hover:bg-seal-50/40"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${style.dot}`} />
              <span className="min-w-0 truncate text-lg font-medium">
                <TypeGlyph type={a.actType} size={13} className="mr-1.5" />
                {a.fullName}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span
                  className={`border border-dashed border-stone-300 px-2 py-0.5 font-[family-name:var(--font-plex-mono)] text-[10px] tracking-[0.1em] uppercase ${style.text}`}
                >
                  {a.actType}
                </span>
                <span className="text-sm text-stone-500">
                  {a._count.entries.toLocaleString("th-TH")} ฉบับ
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center text-sm">
          {page > 1 && (
            <Link href={pageUrl(page - 1)} className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link href={pageUrl(page + 1)} className="rounded border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-100">
              ถัดไป →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
