import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { buildCitation } from "@/lib/cite";
import { CopyCite } from "@/app/components/copy-cite";

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
        / <span className="text-slate-700">สำเนาอ้างอิง</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-xl font-bold leading-snug">{entry.title}</h1>
        <div className="text-sm text-slate-500 flex flex-wrap gap-x-3">
          <span>{formatThaiDate(entry.publishedAt)}</span>
          <span>ที่มาของสำเนา: ห้องสมุดกฎหมาย สำนักงานคณะกรรมการกฤษฎีกา</span>
        </div>
        {entry.act && (
          <div className="text-sm">
            ออกตามความใน{" "}
            <Link href={`/act/${entry.act.id}`} className="text-amber-700 hover:underline">
              {entry.act.fullName}
            </Link>
          </div>
        )}
        <div className="pt-1">
          <CopyCite citation={buildCitation(entry)} />
        </div>
      </header>

      <div className="rounded-lg border border-slate-300 bg-white p-4 text-sm space-y-2">
        <div className="font-bold">การเข้าถึงต้นฉบับ</div>
        {entry.volume > 0 ? (
          <p>
            ต้นฉบับประกาศใน<b>ราชกิจจานุเบกษา เล่ม {entry.volume} ตอนที่ {entry.issue}{" "}
            {entry.category} หน้า {entry.page}</b>
            {entry.publishedAt && <> วันที่ {formatThaiDate(entry.publishedAt)}</>} — ค้นหาฉบับ
            PDF ได้ที่{" "}
            <a
              href="https://ratchakitcha.soc.go.th"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 underline"
            >
              ratchakitcha.soc.go.th
            </a>
          </p>
        ) : (
          <p>
            เอกสารนี้อยู่ในระบบค้นหากฎหมายของสำนักงานคณะกรรมการกฤษฎีกา ซึ่งยังไม่มีลิงก์สาธารณะแบบถาวร —
            ค้นหาจากชื่อเรื่องได้ที่{" "}
            <a
              href="https://www.ocs.go.th/searchlaw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 underline"
            >
              ocs.go.th/searchlaw
            </a>
          </p>
        )}
        <p className="text-amber-800">
          ⚠️ ข้อความด้านล่างเป็น<b>สำเนาเพื่อความสะดวกในการอ้างอิง</b> (แปลงจากต้นฉบับด้วยเครื่อง
          อาจมีคลาดเคลื่อน) — การใช้อ้างอิงทางกฎหมายให้ยึดต้นฉบับเป็นสำคัญ
        </p>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 sm:p-10 leading-relaxed whitespace-pre-wrap text-[15px]">
        {text}
      </article>
    </div>
  );
}
