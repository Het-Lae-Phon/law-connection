import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { SearchBox } from "@/app/components/search-box";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [entryCount, actCount, linkedCount, topActs, recentLaws] = await Promise.all([
    prisma.gazetteEntry.count(),
    prisma.act.count(),
    prisma.gazetteEntry.count({ where: { actId: { not: null }, isPrimary: false } }),
    prisma.act.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: { entries: { _count: "desc" } },
      take: 12,
    }),
    prisma.gazetteEntry.findMany({
      where: { category: "ก" },
      orderBy: { publishedAt: "desc" },
      take: 8,
      include: { act: true },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="text-center space-y-5 pt-4 pb-6">
        {/* blind-emboss wordmark — echoes the printed edition's cover */}
        <div
          aria-hidden
          className="embossed font-[family-name:var(--font-serif-thai)] font-bold text-[64px] sm:text-[88px] leading-none pt-4"
        >
          สารบาญ
        </div>
        <p className="font-[family-name:var(--font-plex-mono)] text-[11px] tracking-[0.3em] uppercase text-stone-400 -mt-2">
          Sarabaan · Thai Law Reference Index
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-serif-thai)]">
          อ้างอิงกฎหมายให้ถูกฉบับ แล้ว<span className="text-seal-700">ไปที่ต้นฉบับ</span>
        </h1>
        <p className="text-stone-600 max-w-2xl mx-auto">
          ดัชนีกฎหมายไทยและกฎหมายลำดับรองที่เชื่อมโยงถึงกัน — ค้นหา คัดลอกการอ้างอิงที่ถูกต้อง
          และตามลิงก์ไปยังต้นฉบับในราชกิจจานุเบกษาหรือหน่วยงานผู้ออกกฎหมาย
        </p>
        <div className="flex max-w-xl mx-auto">
          <SearchBox />
        </div>
        <div className="mx-auto max-w-xl grid grid-cols-3 border-y border-stone-200 divide-x divide-stone-200 text-center">
          {[
            [entryCount, "ประกาศราชกิจจาฯ"],
            [actCount, "กฎหมายแม่บท"],
            [linkedCount, "เชื่อมโยงแล้ว"],
          ].map(([n, label]) => (
            <div key={String(label)} className="py-3">
              <div className="font-[family-name:var(--font-plex-mono)] text-lg text-stone-900">
                {Number(n).toLocaleString("th-TH")}
              </div>
              <div className="text-xs text-stone-500">{String(label)}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold">กฎหมายแม่บทที่มีความเคลื่อนไหวมากที่สุด</h2>
          <Link href="/acts" className="text-sm text-seal-700 hover:underline">
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {topActs.map((a) => (
            <Link
              key={a.id}
              href={`/act/${a.id}`}
              className="rounded-lg border border-stone-200 bg-white p-4 hover:border-seal-300 hover:shadow-sm transition"
            >
              <div className="font-semibold leading-snug">{a.fullName}</div>
              <div className="text-sm text-stone-500 mt-1">
                {a._count.entries.toLocaleString("th-TH")} ฉบับที่เกี่ยวข้อง
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">กฎหมายประกาศใหม่ล่าสุด (ประเภท ก)</h2>
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {recentLaws.map((e) => (
            <li key={e.id} className="p-4 space-y-1">
              <a
                href={e.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-seal-700 leading-snug block"
              >
                {e.title}
              </a>
              <div className="text-sm text-stone-500 flex flex-wrap gap-x-3">
                <span>{formatThaiDate(e.publishedAt)}</span>
                <span>
                  เล่ม {e.volume} ตอนที่ {e.issue} หน้า {e.page}
                </span>
                {e.act && (
                  <Link href={`/act/${e.act.id}`} className="text-seal-700 hover:underline">
                    ↳ {e.act.fullName}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
