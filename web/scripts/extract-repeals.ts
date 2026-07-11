/**
 * #4 Repeal marking (mark, never delete).
 *
 * Act-level: a new act's opening sections list what it repeals —
 *   "ให้ยกเลิก (๑) พระราชบัญญัติ X พ.ศ. ๒๕๑๘ (๒) ..."
 * We scan the full text of primary entries, extract repealed act names, match
 * them against the registry, and set Act.status="repealed" + repealedById.
 *
 * Precision rules:
 *  - "ให้ยกเลิกความใน..." (replacing a section's text) is an amendment, NOT a
 *    repeal — excluded by requiring an act-type word right after ยกเลิก.
 *  - the repealed act must resolve to a DIFFERENT act row than the repealer.
 *  - a repeal target must carry its own พ.ศ. year (whole-act citations do).
 *
 * Usage: npx tsx scripts/extract-repeals.ts [--test]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
function arab(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}
function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

// "ยกเลิก [(n)] พระราชบัญญัติ<ชื่อ> [(ฉบับที่ n)] พ.ศ. <ปี>"
const REPEAL_RE = new RegExp(
  "ยกเลิก\\s*(?:\\([๐-๙0-9]+\\)\\s*)?" +
    "(พระราชบัญญัติประกอบรัฐธรรมนูญ|พระราชบัญญัติ|พระราชกำหนด)\\s*" +
    "([ก-๛0-9A-Za-z.\\- ]+?)\\s*" +
    "(?:\\(ฉบับที่\\s*[๐-๙0-9]+\\)\\s*)?" +
    "(?:พุทธศักราช|พ\\.ศ\\.)\\s*([๐-๙0-9]{4})",
  "g"
);

export interface RepealHit {
  actType: string;
  shortName: string;
  year: number;
}

export function extractRepeals(rawText: string): RepealHit[] {
  const text = rawText.replace(/ํา/g, "ำ").replace(/\\_/g, "").replace(/\s+/g, " ");
  // only look at the head of the document — repeal lists live in มาตรา ๓/๔;
  // later "ยกเลิก" mentions are about sub-instruments or transitional clauses
  const head = text.slice(0, 4000);
  const hits: RepealHit[] = [];
  for (const m of head.matchAll(REPEAL_RE)) {
    // guard: "ยกเลิกความใน..." never matches because the act-type word is
    // required immediately; but also skip "แก้ไขเพิ่มเติม<act>" self-references
    const name = m[2].replace(/ซึ่งแก้ไขเพิ่มเติมโดย.*$/, "").trim();
    if (!name || name.length < 3) continue;
    hits.push({ actType: m[1], shortName: name, year: parseInt(arab(m[3]), 10) });
  }
  return hits;
}

async function main() {
  const test = process.argv.includes("--test");

  // candidate repealers: primary entries (the act itself) with full text
  const primaries = await prisma.gazetteEntry.findMany({
    where: { isPrimary: true, isAmendment: false, actId: { not: null }, documentText: { isNot: null } },
    select: { id: true, actId: true, title: true },
  });
  console.log(`${primaries.length} primary entries with text`);

  const acts = await prisma.act.findMany({
    select: { id: true, actType: true, shortName: true, year: true, fullName: true },
  });
  // index by actType+shortName; keep all (duplicates resolved by year proximity)
  const byName = new Map<string, typeof acts>();
  for (const a of acts) {
    const k = compact(a.actType + a.shortName);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(a);
  }

  let marked = 0;
  const BATCH = 200;
  for (let i = 0; i < primaries.length; i += BATCH) {
    const slice = primaries.slice(i, i + BATCH);
    const texts = await prisma.documentText.findMany({
      where: { entryId: { in: slice.map((p) => p.id) } },
      select: { entryId: true, text: true },
    });
    const tById = new Map(texts.map((t) => [t.entryId, t.text]));
    for (const p of slice) {
      const hits = extractRepeals(tById.get(p.id) ?? "");
      for (const h of hits) {
        const candidates = byName.get(compact(h.actType + h.shortName)) ?? [];
        // prefer the row whose year matches the repealed citation
        const target =
          candidates.find((c) => c.year === h.year) ??
          candidates.find((c) => c.year == null) ??
          null;
        if (!target || target.id === p.actId) continue; // self / unknown
        if (test) {
          const repealer = acts.find((a) => a.id === p.actId);
          console.log(
            `REPEAL: ${target.fullName.slice(0, 55)}  ⇐ by ${repealer?.fullName.slice(0, 55)}`
          );
        } else {
          await prisma.act.update({
            where: { id: target.id },
            data: { status: "repealed", repealedById: p.actId },
          });
        }
        marked++;
      }
    }
  }
  console.log(`\n${test ? "TEST — would mark" : "marked"} ${marked} acts as repealed`);
  await prisma.$disconnect();
}

if (process.argv[1]?.includes("extract-repeals")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
