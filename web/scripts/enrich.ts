/**
 * Second-pass linking: for section ก sub-instruments whose gazette title does not
 * name the parent act, download the PDF and parse the preamble for
 * "อาศัยอำนาจตามความใน ... แห่งพระราชบัญญัติ X พ.ศ. YYYY".
 *
 * PDFs are cached under ../data/pdfs. Some older PDFs have broken font encodings
 * (garbled extraction) — those are counted and skipped; a production pipeline
 * would OCR them.
 *
 * Usage: npx tsx scripts/enrich.ts [limit]
 */
import { PrismaClient } from "@prisma/client";
import { PDFParse } from "pdf-parse";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execFileP = promisify(execFile);
const prisma = new PrismaClient();
const PDF_DIR = path.join(__dirname, "..", "..", "data", "pdfs");
const OCR_BIN = path.join(__dirname, "ocr");

const CODE_NAMES = [
  "ประมวลกฎหมายแพ่งและพาณิชย์",
  "ประมวลกฎหมายอาญา",
  "ประมวลกฎหมายวิธีพิจารณาความแพ่ง",
  "ประมวลกฎหมายวิธีพิจารณาความอาญา",
  "ประมวลกฎหมายที่ดิน",
  "ประมวลกฎหมายยาเสพติด",
  "ประมวลรัษฎากร",
];

function thaiDigitsToArabic(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)));
}

// Compact for matching: drop all whitespace, normalize decomposed sara-am.
function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

// Fraction of characters that are Thai — low means garbled font extraction.
function thaiRatio(s: string): number {
  if (!s) return 0;
  const thai = (s.match(/[ก-๛]/g) ?? []).length;
  return thai / s.length;
}

interface FoundRef {
  actType: string;
  shortName: string; // compacted
  year: number | null;
}

function findRefInPreamble(compactText: string): FoundRef | null {
  // e.g. "...ตามความในมาตรา๕แห่งพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคลพ.ศ.๒๕๖๒..."
  const re =
    /(?:แห่ง|ใน|ตาม)(พระราชบัญญัติประกอบรัฐธรรมนูญ|พระราชบัญญัติ|พระราชกำหนด)([ก-๛0-9A-Za-z.()\-]+?)พ\.ศ\.([๐-๙0-9]{4})/;
  const m = compactText.match(re);
  if (m) {
    let name = m[2].replace(/\(ฉบับที่[๐-๙0-9]+\)$/, "");
    return {
      actType: m[1],
      shortName: name,
      year: parseInt(thaiDigitsToArabic(m[3]), 10),
    };
  }
  for (const code of CODE_NAMES) {
    if (compactText.includes("แห่ง" + code) || compactText.includes("ใน" + code)) {
      return { actType: "ประมวลกฎหมาย", shortName: compact(code), year: null };
    }
  }
  return null;
}

async function fetchPdf(url: string): Promise<Buffer | null> {
  const name = url.split("/").slice(-1)[0].replace(/[^\w.]/g, "_");
  const cached = path.join(PDF_DIR, name);
  if (fs.existsSync(cached)) return fs.readFileSync(cached);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(cached, buf);
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;

  const targets = await prisma.gazetteEntry.findMany({
    where: {
      category: "ก",
      isPrimary: false,
      actId: null,
      instrumentType: {
        in: ["กฎกระทรวง", "พระราชกฤษฎีกา", "กฎ", "ระเบียบ", "ข้อบังคับ", "ประกาศ", "ข้อกำหนด", "คำสั่ง"],
      },
    },
    orderBy: { publishedAt: "desc" },
    take: Number.isFinite(limit) ? limit : undefined,
  });
  console.log(`enriching ${targets.length} entries from PDF preambles`);

  // registry: compacted shortName -> act id
  const acts = await prisma.act.findMany();
  const byCompact = new Map<string, number>();
  for (const a of acts) byCompact.set(compact(a.actType + a.shortName), a.id);

  let linked = 0,
    garbled = 0,
    noRef = 0,
    fetchFail = 0,
    ocrUsed = 0,
    done = 0;

  const queue = [...targets];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const entry = queue.shift()!;
      done++;
      if (done % 100 === 0)
        console.log(`  ${done}/${targets.length} (linked ${linked}, ocr ${ocrUsed}, garbled ${garbled}, noref ${noRef}, fetchfail ${fetchFail})`);
      const buf = await fetchPdf(entry.pdfUrl);
      if (!buf) {
        fetchFail++;
        continue;
      }
      let text = "";
      try {
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        const res = await parser.getText({ first: 2 });
        text = res.text ?? "";
        await parser.destroy();
      } catch {
        text = "";
      }
      if (thaiRatio(text.replace(/\s+/g, "")) < 0.5) {
        // broken embedded font (typical for section ก PDFs) — OCR the first 2 pages
        try {
          const name = entry.pdfUrl.split("/").slice(-1)[0].replace(/[^\w.]/g, "_");
          const { stdout } = await execFileP(OCR_BIN, [path.join(PDF_DIR, name), "2"], {
            timeout: 60000,
            maxBuffer: 4 * 1024 * 1024,
          });
          text = stdout;
          ocrUsed++;
        } catch {
          garbled++;
          continue;
        }
        if (thaiRatio(text.replace(/\s+/g, "")) < 0.5) {
          garbled++;
          continue;
        }
      }
      const ref = findRefInPreamble(compact(text));
      if (!ref) {
        noRef++;
        continue;
      }
      const key = compact(ref.actType + ref.shortName);
      let actId = byCompact.get(key);
      if (!actId) {
        const fullName =
          ref.actType === "ประมวลกฎหมาย"
            ? ref.shortName
            : `${ref.actType}${ref.shortName}${ref.year ? ` พ.ศ. ${ref.year}` : ""}`;
        const slug = `${ref.actType}-${ref.shortName}${ref.year ? `-${ref.year}` : ""}`;
        try {
          const created = await prisma.act.create({
            data: {
              slug,
              actType: ref.actType,
              shortName: ref.shortName.replace(/^ประมวลกฎหมาย|^ประมวล/, "") || ref.shortName,
              year: ref.year,
              fullName,
            },
          });
          actId = created.id;
          byCompact.set(key, actId);
        } catch {
          actId = byCompact.get(key); // lost a race with another worker
        }
      }
      if (actId) {
        await prisma.gazetteEntry.update({ where: { id: entry.id }, data: { actId } });
        linked++;
      }
      await new Promise((r) => setTimeout(r, 150)); // be polite to the gazette server
    }
  });
  await Promise.all(workers);

  console.log(`done: linked ${linked}, ocr-used ${ocrUsed}, garbled ${garbled}, no-ref ${noRef}, fetch-fail ${fetchFail} of ${targets.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
