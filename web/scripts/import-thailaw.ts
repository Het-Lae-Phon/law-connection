/**
 * Import processed thailaw JSONL (Krisdika/OCS law library full-text corpus,
 * see process-thailaw.py) into the database:
 *  - deduplicates against existing gazette entries by normalized title
 *  - merges acts into the existing registry by compacted name
 *  - links sub-regulations via the parent reference extracted from full text
 *
 * Usage: npx tsx scripts/import-thailaw.ts [jsonl]  (default ../data/thailaw/processed.jsonl)
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const prisma = new PrismaClient();

interface Row {
  id: number;
  title: string;
  instrumentType: string | null;
  isPrimary: boolean;
  isAmendment: boolean;
  parent: { actType: string; shortName: string; year: number | null } | null;
  gazette: {
    volume: number;
    issue: string;
    category: string;
    page: number;
    date: string | null;
  } | null;
}

const PRIMARY_TYPES = ["พระราชบัญญัติประกอบรัฐธรรมนูญ", "พระราชบัญญัติ", "พระราชกำหนด"];

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

// Own-name parse for a primary act's title (mirrors ingest.ts)
function parsePrimaryTitle(title: string, actType: string) {
  const m = title
    .slice(actType.length)
    .match(/^\s*([฀-๿0-9A-Za-z.\- ]+?)\s*(\(ฉบับที่\s*[0-9]+\)\s*)?พ\.ศ\.\s*([0-9]{4})/);
  if (!m) return null;
  return {
    actType,
    shortName: m[1].trim(),
    year: m[2] ? null : parseInt(m[3], 10),
    isAmendment: !!m[2],
  };
}

async function main() {
  const file = process.argv[2] ?? path.join(__dirname, "..", "..", "data", "thailaw", "processed.jsonl");

  // Dedup set: normalized titles of everything already in the DB.
  const existing = await prisma.gazetteEntry.findMany({ select: { title: true } });
  const seenTitles = new Set(existing.map((e) => compact(e.title)));
  console.log(`existing entries: ${existing.length}`);

  // Act registry keyed by compact(actType + shortName)
  const acts = await prisma.act.findMany();
  const actIds = new Map<string, number>();
  for (const a of acts) actIds.set(compact(a.actType + a.shortName), a.id);

  async function resolveAct(ref: { actType: string; shortName: string; year: number | null }) {
    const key = compact(ref.actType + ref.shortName);
    let id = actIds.get(key);
    if (id) return id;
    const fullName =
      ref.actType === "ประมวลกฎหมาย"
        ? `ประมวลกฎหมาย${ref.shortName}`.replace("ประมวลกฎหมายรัษฎากร", "ประมวลรัษฎากร")
        : `${ref.actType}${ref.shortName}${ref.year ? ` พ.ศ. ${ref.year}` : ""}`;
    const slug = `${ref.actType}-${ref.shortName}${ref.year ? `-${ref.year}` : ""}`.replace(/\s+/g, "-");
    try {
      const created = await prisma.act.create({
        data: { slug, actType: ref.actType, shortName: ref.shortName, year: ref.year, fullName },
      });
      id = created.id;
    } catch {
      // slug collision (same name, no year vs year) — retry with unique suffix
      const created = await prisma.act.create({
        data: {
          slug: `${slug}-x${Date.now() % 100000}`,
          actType: ref.actType,
          shortName: ref.shortName,
          year: ref.year,
          fullName,
        },
      });
      id = created.id;
    }
    actIds.set(key, id);
    return id;
  }

  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  let imported = 0,
    duped = 0,
    linked = 0,
    batch: {
      title: string;
      publishedAt: Date | null;
      volume: number;
      issue: string;
      category: string;
      page: number;
      pdfUrl: string;
      origin: string;
      instrumentType: string | null;
      isPrimary: boolean;
      isAmendment: boolean;
      actId: number | null;
      linkSource: string | null;
    }[] = [];

  const flush = async () => {
    if (!batch.length) return;
    await prisma.gazetteEntry.createMany({ data: batch });
    batch = [];
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as Row;
    const key = compact(r.title);
    if (seenTitles.has(key)) {
      duped++;
      continue;
    }
    seenTitles.add(key);

    let actId: number | null = null;
    if (r.isPrimary && r.instrumentType && PRIMARY_TYPES.includes(r.instrumentType)) {
      const own = parsePrimaryTitle(r.title, r.instrumentType);
      if (own) actId = await resolveAct(own);
    } else if (r.parent && r.parent.shortName) {
      actId = await resolveAct(r.parent);
    }
    if (actId) linked++;

    let publishedAt: Date | null = null;
    if (r.gazette?.date) {
      const d = new Date(r.gazette.date + "T00:00:00Z");
      // guard against typos in source documents (e.g. day "33")
      if (!isNaN(d.getTime()) && d.toISOString().slice(0, 10) === r.gazette.date) {
        publishedAt = d;
      }
    }
    batch.push({
      title: r.title,
      publishedAt,
      volume: r.gazette?.volume ?? 0,
      issue: r.gazette?.issue ?? "",
      category: r.gazette?.category ?? "",
      page: r.gazette?.page ?? 0,
      pdfUrl: `thailaw:${r.id}`,
      origin: "krisdika",
      instrumentType: r.instrumentType,
      isPrimary: r.isPrimary,
      isAmendment: r.isAmendment,
      actId,
      linkSource: actId ? "text" : null,
    });
    imported++;
    if (batch.length >= 2000) await flush();
  }
  await flush();

  const totalActs = await prisma.act.count();
  console.log(
    `imported ${imported} library docs (${duped} duplicates skipped), linked ${linked}, act registry now ${totalActs}`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
