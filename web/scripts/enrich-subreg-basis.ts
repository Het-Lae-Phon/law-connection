/**
 * Enrich sub-regulations that have no full text: OCR the source PDF, store the
 * text as DocumentText (so it becomes readable on-site) and extract the
 * authorising section(s) into legalBasis — filling the section-level chain for
 * acts whose sub-regs came in as metadata only (e.g. the PDPA announcements,
 * which are published in section ง / on pdpc.or.th and were never in the
 * Krisdika full-text corpus).
 *
 * OCR uses the Vision-based scripts/ocr binary because section-ก gazette PDFs
 * have broken font encodings; born-digital pdpc.or.th PDFs OCR cleanly too.
 *
 * Usage: npx tsx scripts/enrich-subreg-basis.ts <actId> [--pages N] [--dry]
 */
import { PrismaClient } from "@prisma/client";
import { extractLegalBasis } from "./extract-legal-basis";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const prisma = new PrismaClient();
const OCR = join(import.meta.dirname, "ocr");

async function ocrPdf(url: string, pages: number): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000 || buf.subarray(0, 4).toString() !== "%PDF") return null;
  const dir = mkdtempSync(join(tmpdir(), "subreg-"));
  const file = join(dir, "doc.pdf");
  try {
    writeFileSync(file, buf);
    const out = execFileSync(OCR, [file, String(pages)], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return out.replace(/ํา/g, "ำ").replace(/[ \t]+\n/g, "\n").trim() || null;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const actId = parseInt(process.argv[2] ?? "", 10);
  if (isNaN(actId)) {
    console.error("usage: enrich-subreg-basis.ts <actId> [--pages N] [--dry]");
    process.exit(1);
  }
  const dry = process.argv.includes("--dry");
  const pagesArg = process.argv.findIndex((a) => a === "--pages");
  const pages = pagesArg >= 0 ? parseInt(process.argv[pagesArg + 1], 10) : 6;

  const act = await prisma.act.findUnique({ where: { id: actId }, select: { fullName: true, shortName: true, actType: true } });
  if (!act) { console.error(`act ${actId} not found`); process.exit(1); }
  console.log(`enriching sub-regs of: ${act.fullName}`);

  const subs = await prisma.gazetteEntry.findMany({
    where: { actId, isPrimary: false, documentText: { is: null } },
    select: { id: true, title: true, pdfUrl: true, sourceUrl: true },
  });
  const withPdf = subs.filter((e) => /^https?:.+\.pdf($|\?)/i.test(e.pdfUrl) || /^https?:.+\.pdf($|\?)/i.test(e.sourceUrl ?? ""));
  console.log(`${subs.length} without text; ${withPdf.length} have a PDF url`);

  let text = 0, basis = 0;
  for (const e of withPdf) {
    const url = /\.pdf/i.test(e.pdfUrl) ? e.pdfUrl : e.sourceUrl!;
    const ocr = await ocrPdf(url, pages);
    if (!ocr || ocr.length < 80) { console.log(`  ✗ OCR failed: ${e.title.slice(0, 55)}`); continue; }
    text++;
    const lb = extractLegalBasis(ocr, act.actType === "รัฐธรรมนูญ", act.shortName);
    if (lb) basis++;
    console.log(`  ✓ ${lb ?? "(no basis)"}  ←  ${e.title.slice(0, 55)}`);
    if (!dry) {
      await prisma.documentText.upsert({
        where: { entryId: e.id },
        create: { entryId: e.id, text: ocr },
        update: { text: ocr },
      });
      if (lb) await prisma.gazetteEntry.update({ where: { id: e.id }, data: { legalBasis: lb } });
    }
  }
  console.log(`\n${dry ? "DRY — " : ""}OCR'd ${text}, extracted basis for ${basis}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
