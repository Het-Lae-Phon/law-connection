import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ActsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const acts = await prisma.act.findMany({
    where: query ? { fullName: { contains: query } } : undefined,
    include: { _count: { select: { entries: true } } },
    orderBy: { entries: { _count: "desc" } },
    take: 300,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">กฎหมายแม่บททั้งหมด</h1>
      <form className="flex max-w-xl gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="กรองตามชื่อกฎหมาย เช่น ภาษี, แรงงาน..."
          className="flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-seal-500"
        />
        <button type="submit" className="rounded-lg bg-stone-900 text-white px-5 py-2 hover:bg-stone-700">
          กรอง
        </button>
      </form>
      <p className="text-sm text-stone-500">
        {acts.length.toLocaleString("th-TH")} รายการ เรียงตามจำนวนฉบับที่เชื่อมโยง
        (ทะเบียนนี้สร้างอัตโนมัติจากประกาศในราชกิจจานุเบกษาและการอ้างอิงในกฎหมายลำดับรอง)
      </p>
      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {acts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/act/${a.id}`}
              className="flex items-baseline justify-between gap-4 p-4 hover:bg-seal-50"
            >
              <span className="font-medium leading-snug">{a.fullName}</span>
              <span className="shrink-0 text-sm text-stone-500">
                {a._count.entries.toLocaleString("th-TH")} ฉบับ
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
