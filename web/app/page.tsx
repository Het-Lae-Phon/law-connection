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
      <section className="text-center space-y-4 py-6">
        <h1 className="text-3xl font-bold">
          อ้างอิงกฎหมายให้ถูกฉบับ แล้ว<span className="text-amber-600">ไปที่ต้นฉบับ</span>
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          ดัชนีกฎหมายไทยและกฎหมายลำดับรองที่เชื่อมโยงถึงกัน — ค้นหา คัดลอกการอ้างอิงที่ถูกต้อง
          และตามลิงก์ไปยังต้นฉบับในราชกิจจานุเบกษาหรือหน่วยงานผู้ออกกฎหมาย
        </p>
        <div className="flex max-w-xl mx-auto">
          <SearchBox />
        </div>
        <div className="flex justify-center gap-8 text-sm text-slate-500 pt-2">
          <span>
            <b className="text-slate-900 text-lg">{entryCount.toLocaleString("th-TH")}</b>{" "}
            ประกาศราชกิจจาฯ
          </span>
          <span>
            <b className="text-slate-900 text-lg">{actCount.toLocaleString("th-TH")}</b>{" "}
            กฎหมายแม่บท
          </span>
          <span>
            <b className="text-slate-900 text-lg">{linkedCount.toLocaleString("th-TH")}</b>{" "}
            ฉบับที่เชื่อมโยงแล้ว
          </span>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold">กฎหมายแม่บทที่มีความเคลื่อนไหวมากที่สุด</h2>
          <Link href="/acts" className="text-sm text-amber-700 hover:underline">
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {topActs.map((a) => (
            <Link
              key={a.id}
              href={`/act/${a.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-amber-400 hover:shadow-sm transition"
            >
              <div className="font-semibold leading-snug">{a.fullName}</div>
              <div className="text-sm text-slate-500 mt-1">
                {a._count.entries.toLocaleString("th-TH")} ฉบับที่เกี่ยวข้อง
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">กฎหมายประกาศใหม่ล่าสุด (ประเภท ก)</h2>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {recentLaws.map((e) => (
            <li key={e.id} className="p-4 space-y-1">
              <Link
                href={`/entry/${e.id}`}
                className="font-medium hover:text-amber-700 leading-snug block"
              >
                {e.title}
              </Link>
              <div className="text-sm text-slate-500 flex flex-wrap gap-x-3">
                <span>{formatThaiDate(e.publishedAt)}</span>
                <span>
                  เล่ม {e.volume} ตอนที่ {e.issue} หน้า {e.page}
                </span>
                {e.act && (
                  <Link href={`/act/${e.act.id}`} className="text-amber-700 hover:underline">
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
