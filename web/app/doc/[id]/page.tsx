import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) notFound();

  const entry = await prisma.gazetteEntry.findUnique({
    where: { id: entryId },
    include: { act: true, documentText: true },
  });
  if (!entry || !entry.documentText) notFound();

  // Collapse the exported markdown escapes and normalize blank runs for reading.
  const text = entry.documentText.text
    .replace(/\\_/g, "_")
    .replace(/\n{3,}/g, "\n\n");

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          หน้าแรก
        </Link>{" "}
        {entry.act && (
          <>
            /{" "}
            <Link href={`/act/${entry.act.id}`} className="hover:underline">
              {entry.act.shortName}
            </Link>{" "}
          </>
        )}
        / <span className="text-slate-700">ฉบับเต็ม</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-xl font-bold leading-snug">{entry.title}</h1>
        <div className="text-sm text-slate-500 flex flex-wrap gap-x-3">
          <span>{formatThaiDate(entry.publishedAt)}</span>
          {entry.volume > 0 && (
            <span>
              ราชกิจจานุเบกษา เล่ม {entry.volume} ตอนที่ {entry.issue} {entry.category} หน้า{" "}
              {entry.page}
            </span>
          )}
          <span>ที่มา: ห้องสมุดกฎหมาย สำนักงานคณะกรรมการกฤษฎีกา</span>
        </div>
        {entry.act && (
          <div className="text-sm">
            ออกตามความใน{" "}
            <Link href={`/act/${entry.act.id}`} className="text-amber-700 hover:underline">
              {entry.act.fullName}
            </Link>
          </div>
        )}
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        ⚠️ ข้อความนี้คัดลอกจากฐานข้อมูลแบบเปิด (แปลงจากเอกสารต้นฉบับด้วยเครื่อง) อาจมีคลาดเคลื่อน —
        โปรดตรวจสอบกับราชกิจจานุเบกษาหรือต้นฉบับของหน่วยงานก่อนใช้อ้างอิงทางกฎหมาย
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 sm:p-10 leading-relaxed whitespace-pre-wrap text-[15px]">
        {text}
      </article>
    </div>
  );
}
