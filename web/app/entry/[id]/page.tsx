import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatThaiDate } from "@/lib/format";
import { buildCitation, originalSource } from "@/lib/cite";
import { confirmLink, disputeLink } from "@/lib/actions";
import { CopyCite } from "@/app/components/copy-cite";
import { VerifyBadge } from "@/app/components/verify-badge";
import { BackLink } from "@/app/components/back-link";
import { BasisChips } from "@/app/components/basis-chips";
import { TypeGlyph } from "@/app/components/geo-shape";
import { sdkSlugFor } from "@/lib/thai-law";

export const dynamic = "force-dynamic";

const ORIGIN_LABELS: Record<string, string> = {
  krisdika: "ห้องสมุดกฎหมาย สำนักงานคณะกรรมการกฤษฎีกา",
  pdpc: "เว็บไซต์ สคส. (PDPC)",
};

async function getEntry(id: number) {
  return prisma.gazetteEntry.findUnique({
    where: { id },
    include: { act: true, documentText: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) return {};
  const entry = await getEntry(entryId);
  if (!entry) return {};
  const description = entry.act
    ? `${entry.title} — ออกตามความใน${entry.act.fullName}. ${buildCitation(entry)}`
    : buildCitation(entry);
  return {
    title: `${entry.title} — กฎหมายเชื่อมโยง`,
    description: description.slice(0, 300),
  };
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) notFound();

  const entry = await getEntry(entryId);
  if (!entry) notFound();

  const source = originalSource(entry);
  const hasText = !!entry.documentText;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-stone-500">
        <BackLink fallbackHref="/entries" />
      </nav>

      <header className="space-y-3">
        {entry.instrumentType && (
          <div className="text-sm font-medium text-seal-700">{entry.instrumentType}</div>
        )}
        <h1 className="text-xl font-bold leading-snug">
          {entry.title}
          {entry.isAmendment && (
            <span className="ml-2 inline-block rounded bg-seal-100 text-seal-800 text-xs px-1.5 py-0.5 align-middle">
              ฉบับแก้ไข
            </span>
          )}
        </h1>
        <div className="text-sm text-stone-500 flex flex-wrap gap-x-3">
          <span>{formatThaiDate(entry.publishedAt)}</span>
          {entry.volume > 0 && (
            <span>
              เล่ม {entry.volume} ตอนที่ {entry.issue} {entry.category}
              {entry.page > 0 ? ` หน้า ${entry.page}` : ""}
            </span>
          )}
          {ORIGIN_LABELS[entry.origin] && <span>{ORIGIN_LABELS[entry.origin]}</span>}
        </div>
        {entry.act && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <BasisChips
              legalBasis={entry.legalBasis}
              label="ออกตามความใน"
              sectionsHref={sdkSlugFor(entry.act) ? `/act/${entry.act.id}/sections` : undefined}
            />
            <span className="text-stone-500">{entry.legalBasis ? "แห่ง" : "ออกตามความใน"}</span>
            <Link href={`/act/${entry.act.id}`} className="inline-flex items-center gap-1.5 text-seal-700 hover:underline">
              <TypeGlyph type={entry.act.actType} size={12} />
              {entry.act.fullName}
            </Link>
          </div>
        )}
        {!entry.act && entry.legalBasis && (
          <div className="text-sm">
            <BasisChips legalBasis={entry.legalBasis} label="ออกตามความใน" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <VerifyBadge status={entry.verifyStatus} source={entry.linkSource} />
          <details className="text-xs">
            <summary className="cursor-pointer text-stone-400 hover:text-stone-600 list-none">
              ตรวจสอบความถูกต้อง
            </summary>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              {entry.verifyStatus !== "verified" && (
                <form action={confirmLink}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <button className="text-xs text-green-700 hover:underline" title="ยืนยันว่าการเชื่อมโยงนี้ถูกต้อง">
                    ✓ ยืนยันว่าถูกต้อง
                  </button>
                </form>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-red-700 hover:underline list-none">
                  ⚠ แจ้งว่าไม่ถูกต้อง
                </summary>
                <form
                  action={disputeLink}
                  className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3 w-72"
                >
                  <input type="hidden" name="entryId" value={entry.id} />
                  <textarea
                    name="reason"
                    required
                    placeholder="เหตุผล เช่น ออกตามกฎหมายฉบับอื่น..."
                    className="w-full rounded border border-stone-300 p-2 text-sm"
                    rows={2}
                  />
                  <input
                    name="correctAct"
                    placeholder="กฎหมายแม่บทที่ถูกต้อง (ถ้าทราบ)"
                    className="w-full rounded border border-stone-300 p-2 text-sm"
                  />
                  <input
                    name="contributor"
                    placeholder="ชื่อ/สังกัด (ไม่บังคับ)"
                    className="w-full rounded border border-stone-300 p-2 text-sm"
                  />
                  <button className="rounded bg-red-700 text-white px-3 py-1.5">
                    ส่งข้อโต้แย้ง
                  </button>
                </form>
              </details>
            </div>
          </details>
        </div>
      </header>

      <section className="rounded-lg border border-stone-300 bg-white p-4 text-sm space-y-3">
        <div className="font-bold">การอ้างอิงและต้นฉบับ</div>
        <div className="flex flex-wrap gap-2">
          <CopyCite citation={buildCitation(entry)} />
          {source && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-stone-900 text-white px-3 py-1.5 text-sm hover:bg-stone-700"
            >
              เปิดต้นฉบับ · {source.label} ↗
            </a>
          )}
          {!source && hasText && (
            <Link
              href={`/doc/${entry.id}`}
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
              title="สำเนาข้อความสำหรับอ้างอิง — ไม่ใช่ต้นฉบับ"
            >
              อ่านสำเนาข้อความเต็ม →
            </Link>
          )}
        </div>
        {!source && !hasText && entry.volume > 0 && (
          <p className="text-stone-500">
            ยังไม่มีลิงก์ต้นฉบับที่ใช้งานได้ในระบบ — ค้นหาฉบับ PDF ได้ที่{" "}
            <a
              href="https://ratchakitcha.soc.go.th"
              target="_blank"
              rel="noopener noreferrer"
              className="text-seal-700 underline"
            >
              ratchakitcha.soc.go.th
            </a>{" "}
            โดยใช้เลขที่เล่ม/ตอนด้านบน
          </p>
        )}
      </section>
    </div>
  );
}
