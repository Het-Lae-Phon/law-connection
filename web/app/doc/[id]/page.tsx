import Link from "next/link";
import { notFound } from "next/navigation";
import { Sarabun } from "next/font/google";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { buildCitation } from "@/lib/cite";
import { CopyCite } from "@/app/components/copy-cite";
import { typesetLegalText, type Block } from "@/lib/typeset";

// The Royal Gazette is typeset in TH Sarabun — use its Google-hosted sibling
// so the reference copy reads like the printed original.
const sarabun = Sarabun({
  weight: ["400", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-sarabun",
});

export const dynamic = "force-dynamic";

function DocBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "title":
      return (
        <div className="text-center font-bold text-[1.35em] leading-relaxed pb-3">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          <div className="mx-auto mt-4 w-40 border-b border-stone-800" />
        </div>
      );
    case "meta":
      return (
        <div className="text-center text-[1.1em] leading-loose">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "heading":
      return (
        <div className="text-center font-bold pt-4 leading-loose">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "sign":
      return (
        <div className="text-center leading-loose pt-2">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    case "note":
      return (
        <div className="text-sm text-stone-400 leading-relaxed">
          {block.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      );
    default:
      return (
        <p className="text-justify indent-12 leading-loose m-0">
          {block.lines.join(" ")}
        </p>
      );
  }
}

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) notFound();

  const entry = await prisma.gazetteEntry.findUnique({
    where: { id: entryId },
    include: { act: true, documentText: true },
  });
  if (!entry || !entry.documentText) notFound();

  const blocks = typesetLegalText(entry.documentText.text);
  const bodyBlocks = blocks.filter((b) => b.kind !== "note");
  const noteBlocks = blocks.filter((b) => b.kind === "note");

  return (
    <div className="space-y-6">
      <nav className="text-sm text-stone-500">
        {entry.act && (
          <>
            <Link href={`/act/${entry.act.id}`} className="hover:underline">
              {entry.act.shortName}
            </Link>{" "}
            /{" "}
          </>
        )}
        <span className="text-stone-700">สำเนาอ้างอิง</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-xl font-bold leading-snug">{entry.title}</h1>
        <div className="text-sm text-stone-500 flex flex-wrap gap-x-3">
          <span>{formatThaiDate(entry.publishedAt)}</span>
          <span>ที่มาของสำเนา: ห้องสมุดกฎหมาย สำนักงานคณะกรรมการกฤษฎีกา</span>
        </div>
        {entry.act && (
          <div className="text-sm">
            ออกตามความใน{" "}
            <Link href={`/act/${entry.act.id}`} className="text-seal-700 hover:underline">
              {entry.act.fullName}
            </Link>
          </div>
        )}
        <div className="pt-1">
          <CopyCite citation={buildCitation(entry)} />
        </div>
      </header>

      <div className="rounded-lg border border-stone-300 bg-white p-4 text-sm space-y-2">
        <div className="font-bold">การเข้าถึงต้นฉบับ</div>
        {entry.sourceUrl?.startsWith("http") ? (
          <p>
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-stone-900 text-white px-3 py-1.5 hover:bg-stone-700"
            >
              เปิดต้นฉบับ PDF ในราชกิจจานุเบกษา ↗
            </a>
          </p>
        ) : entry.volume > 0 ? (
          <p>
            ต้นฉบับประกาศใน<b>ราชกิจจานุเบกษา เล่ม {entry.volume} ตอนที่ {entry.issue}{" "}
            {entry.category} หน้า {entry.page}</b>
            {entry.publishedAt && <> วันที่ {formatThaiDate(entry.publishedAt)}</>} — ค้นหาฉบับ
            PDF ได้ที่{" "}
            <a
              href="https://ratchakitcha.soc.go.th"
              target="_blank"
              rel="noopener noreferrer"
              className="text-seal-700 underline"
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
              className="text-seal-700 underline"
            >
              ocs.go.th/searchlaw
            </a>
          </p>
        )}
        <p className="text-seal-800">
          ⚠️ ข้อความด้านล่างเป็น<b>สำเนาเพื่อความสะดวกในการอ้างอิง</b> (แปลงจากต้นฉบับด้วยเครื่อง
          อาจมีคลาดเคลื่อน) — การใช้อ้างอิงทางกฎหมายให้ยึดต้นฉบับเป็นสำคัญ
        </p>
      </div>

      <article
        className={`${sarabun.className} rounded-lg border border-stone-200 bg-white px-6 py-10 sm:px-16 sm:py-14 text-[17px] text-stone-900 space-y-4`}
      >
        {bodyBlocks.map((b, i) => (
          <DocBlock key={i} block={b} />
        ))}
        {noteBlocks.length > 0 && (
          <div className="mt-10 border-t border-stone-200 pt-4 space-y-2">
            {noteBlocks.map((b, i) => (
              <DocBlock key={i} block={b} />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
