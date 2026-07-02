/**
 * Ingest Royal Gazette monthly JSON dumps (data.go.th dataset_02_04) into SQLite,
 * classify each entry's instrument type, and link sub-regulations to their parent
 * act parsed from the title (e.g. "...ออกตามความในพระราชบัญญัติ X พ.ศ. 2562").
 *
 * Usage: npx tsx scripts/ingest.ts [dataDir]  (default ../data/raw)
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface RawEntry {
  "วันที่": string;
  "เรื่อง": string;
  "เล่ม": number | string;
  "ตอน": number | string;
  "ประเภท": string;
  "หน้า": number | string;
  URL: string;
}

// Primary legislation keywords, longest first so พ.ร.บ.ประกอบรัฐธรรมนูญ wins over พ.ร.บ.
const PRIMARY_TYPES = [
  "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "พระราชบัญญัติ",
  "พระราชกำหนด",
];

// Codes are primary legislation but have no "พ.ศ." in references, so match by fixed names.
const CODE_NAMES = [
  "ประมวลกฎหมายแพ่งและพาณิชย์",
  "ประมวลกฎหมายอาญา",
  "ประมวลกฎหมายวิธีพิจารณาความแพ่ง",
  "ประมวลกฎหมายวิธีพิจารณาความอาญา",
  "ประมวลกฎหมายที่ดิน",
  "ประมวลกฎหมายยาเสพติด",
  "ประมวลรัษฎากร",
];

// Subordinate / other instrument prefixes, longest-prefix-first.
const INSTRUMENT_PREFIXES: [string, string][] = [
  ["พระราชกฤษฎีกา", "พระราชกฤษฎีกา"],
  ["กฎกระทรวง", "กฎกระทรวง"],
  ["กฎ", "กฎ"], // กฎ ก.พ., กฎ ก.ตร., กฎสำนักนายกรัฐมนตรี ...
  ["ประกาศ", "ประกาศ"],
  ["ระเบียบ", "ระเบียบ"],
  ["ข้อบังคับ", "ข้อบังคับ"],
  ["ข้อกำหนด", "ข้อกำหนด"],
  ["คำสั่ง", "คำสั่ง"],
  ["คำวินิจฉัย", "คำวินิจฉัย"],
  ["คำพิพากษา", "คำพิพากษา"],
  ["พระบรมราชโองการ", "พระบรมราชโองการ"],
];

const ACT_REF_RE = new RegExp(
  "(พระราชบัญญัติประกอบรัฐธรรมนูญ|พระราชบัญญัติ|พระราชกำหนด)" +
    "\\s*([\\u0E00-\\u0E7F0-9A-Za-z.\\- ]+?)" +
    "\\s*(?:\\(ฉบับที่\\s*[0-9๐-๙]+\\)\\s*)?" +
    "พ\\.ศ\\.\\s*([0-9๐-๙]{4})",
  "g"
);

function thaiDigitsToArabic(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)));
}

function normalizeName(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/และที่แก้ไขเพิ่มเติม.*$/, "")
    .replace(/ซึ่งแก้ไขเพิ่มเติม.*$/, "")
    .trim();
}

interface ActRef {
  actType: string;
  shortName: string;
  year: number | null;
  isAmendment: boolean;
}

// Parse a primary act's own title, e.g.
// "พระราชบัญญัติการอุดมศึกษา (ฉบับที่ 2) พ.ศ. 2568" → base act "การอุดมศึกษา", amendment.
function parsePrimaryTitle(title: string, actType: string): ActRef | null {
  const rest = title.slice(actType.length);
  const m = rest.match(
    /^\s*([฀-๿0-9A-Za-z.\- ]+?)\s*(\(ฉบับที่\s*[0-9๐-๙]+\)\s*)?พ\.ศ\.\s*([0-9๐-๙]{4})/
  );
  if (!m) return null;
  const isAmendment = !!m[2];
  return {
    actType,
    shortName: normalizeName(m[1]),
    // an amendment's พ.ศ. is the amendment year, not the base act's — leave unknown
    year: isAmendment ? null : parseInt(thaiDigitsToArabic(m[3]), 10),
    isAmendment,
  };
}

// Find the parent act referenced inside a sub-regulation title.
function findParentRef(title: string): ActRef | null {
  ACT_REF_RE.lastIndex = 0;
  const m = ACT_REF_RE.exec(title);
  if (m) {
    return {
      actType: m[1],
      shortName: normalizeName(m[2]),
      year: parseInt(thaiDigitsToArabic(m[3]), 10),
      isAmendment: false,
    };
  }
  for (const code of CODE_NAMES) {
    if (title.includes(code)) {
      return {
        actType: "ประมวลกฎหมาย",
        shortName: code.replace(/^ประมวลกฎหมาย/, "").replace(/^ประมวล/, "") || code,
        year: null,
        isAmendment: false,
      };
    }
  }
  return null;
}

function classify(title: string): { instrumentType: string | null; isPrimary: boolean } {
  for (const t of PRIMARY_TYPES) {
    if (title.startsWith(t)) return { instrumentType: t, isPrimary: true };
  }
  if (title.startsWith("รัฐธรรมนูญ")) {
    return { instrumentType: "รัฐธรรมนูญ", isPrimary: true };
  }
  for (const c of CODE_NAMES) {
    if (title.startsWith(c)) return { instrumentType: "ประมวลกฎหมาย", isPrimary: true };
  }
  for (const [prefix, name] of INSTRUMENT_PREFIXES) {
    if (title.startsWith(prefix)) return { instrumentType: name, isPrimary: false };
  }
  return { instrumentType: null, isPrimary: false };
}

function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  let year = parseInt(m[3], 10);
  if (year > 2400) year -= 543; // some rows use B.E.
  const d = new Date(Date.UTC(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  return isNaN(d.getTime()) ? null : d;
}

function loadRaw(dataDir: string): RawEntry[] {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort();
  const all: RawEntry[] = [];
  for (const f of files) {
    let text = fs.readFileSync(path.join(dataDir, f), "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.warn(`skip ${f}: ${(e as Error).message}`);
      continue;
    }
    // some monthly exports wrap the array in { "Worksheet": [...] }
    const rows = Array.isArray(parsed)
      ? parsed
      : (Object.values(parsed as Record<string, unknown>)[0] as unknown[]);
    if (!Array.isArray(rows)) {
      console.warn(`skip ${f}: unexpected shape`);
      continue;
    }
    all.push(...(rows as RawEntry[]));
  }
  return all;
}

async function main() {
  const dataDir = process.argv[2] ?? path.join(__dirname, "..", "..", "data", "raw");
  const contribCount = await prisma.contribution.count();
  if (contribCount > 0 && !process.argv.includes("--force")) {
    console.error(
      `refusing to wipe: ${contribCount} community contributions exist. ` +
        "Re-ingesting deletes all entries and links. Pass --force to override."
    );
    process.exit(1);
  }
  const raw = loadRaw(dataDir);
  console.log(`loaded ${raw.length} raw rows`);

  // Registry of acts keyed by actType + normalized short name.
  const actKey = (r: { actType: string; shortName: string }) =>
    `${r.actType}|${r.shortName}`;
  const acts = new Map<string, { actType: string; shortName: string; year: number | null }>();

  type Row = {
    title: string;
    publishedAt: Date;
    volume: number;
    issue: string;
    category: string;
    page: number;
    pdfUrl: string;
    instrumentType: string | null;
    isPrimary: boolean;
    isAmendment: boolean;
    actKey: string | null;
  };

  const seen = new Set<string>();
  const rows: Row[] = [];
  let skippedBad = 0;

  for (const e of raw) {
    const title = String(e["เรื่อง"] ?? "").replace(/\s+/g, " ").trim();
    const pdfUrl = String(e.URL ?? "").trim();
    const publishedAt = parseDate(String(e["วันที่"] ?? ""));
    if (!title || !pdfUrl || !publishedAt) {
      skippedBad++;
      continue;
    }
    if (seen.has(pdfUrl)) continue; // months overlap at boundaries
    seen.add(pdfUrl);

    const { instrumentType, isPrimary } = classify(title);
    let isAmendment = false;
    let key: string | null = null;

    if (isPrimary && instrumentType && instrumentType !== "รัฐธรรมนูญ") {
      const ref =
        instrumentType === "ประมวลกฎหมาย"
          ? findParentRef(title)
          : parsePrimaryTitle(title, instrumentType);
      if (ref) {
        isAmendment = ref.isAmendment;
        key = actKey(ref);
        const existing = acts.get(key);
        if (!existing) acts.set(key, { actType: ref.actType, shortName: ref.shortName, year: ref.year });
        else if (existing.year == null && ref.year != null) existing.year = ref.year;
      }
    } else if (!isPrimary && instrumentType) {
      const ref = findParentRef(title);
      if (ref) {
        key = actKey(ref);
        const existing = acts.get(key);
        if (!existing) acts.set(key, { actType: ref.actType, shortName: ref.shortName, year: ref.year });
        else if (existing.year == null && ref.year != null) existing.year = ref.year;
      }
    }

    rows.push({
      title,
      publishedAt,
      volume: parseInt(String(e["เล่ม"]), 10) || 0,
      issue: String(e["ตอน"] ?? ""),
      category: String(e["ประเภท"] ?? "").trim(),
      page: parseInt(String(e["หน้า"]), 10) || 0,
      pdfUrl,
      instrumentType,
      isPrimary,
      isAmendment,
      actKey: key,
    });
  }

  console.log(`prepared ${rows.length} unique entries (${skippedBad} skipped, ${acts.size} acts in registry)`);

  await prisma.gazetteEntry.deleteMany();
  await prisma.act.deleteMany();

  // Insert acts, remember ids.
  const actIds = new Map<string, number>();
  for (const [key, a] of acts) {
    const fullName =
      a.actType === "ประมวลกฎหมาย"
        ? (CODE_NAMES.find((c) => c.includes(a.shortName)) ?? `ประมวลกฎหมาย${a.shortName}`)
        : `${a.actType}${a.shortName}${a.year ? ` พ.ศ. ${a.year}` : ""}`;
    const slug = `${a.actType}-${a.shortName}${a.year ? `-${a.year}` : ""}`.replace(/\s+/g, "-");
    const created = await prisma.act.create({
      data: { slug, actType: a.actType, shortName: a.shortName, year: a.year, fullName },
    });
    actIds.set(key, created.id);
  }
  console.log(`inserted ${actIds.size} acts`);

  const BATCH = 2000;
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.gazetteEntry.createMany({
      data: rows.slice(i, i + BATCH).map((r) => ({
        title: r.title,
        publishedAt: r.publishedAt,
        volume: r.volume,
        issue: r.issue,
        category: r.category,
        page: r.page,
        pdfUrl: r.pdfUrl,
        instrumentType: r.instrumentType,
        isPrimary: r.isPrimary,
        isAmendment: r.isAmendment,
        actId: r.actKey ? (actIds.get(r.actKey) ?? null) : null,
        linkSource: r.actKey ? "title" : null,
      })),
    });
  }

  // Stats
  const total = rows.length;
  const legalish = rows.filter((r) => r.category === "ก" || r.instrumentType);
  const linked = rows.filter((r) => r.actKey);
  const katNonPrimary = rows.filter((r) => r.category === "ก" && !r.isPrimary);
  const katLinked = katNonPrimary.filter((r) => r.actKey);
  console.log(`entries: ${total}, with instrument type: ${legalish.length}, linked to an act: ${linked.length}`);
  console.log(
    `section ก sub-instruments: ${katNonPrimary.length}, of which linked: ${katLinked.length} (${(
      (100 * katLinked.length) / Math.max(1, katNonPrimary.length)
    ).toFixed(1)}%)`
  );

  const top = await prisma.act.findMany({
    include: { _count: { select: { entries: true } } },
    orderBy: { entries: { _count: "desc" } },
    take: 10,
  });
  console.log("top acts by linked entries:");
  for (const a of top) console.log(`  ${a._count.entries}  ${a.fullName}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
