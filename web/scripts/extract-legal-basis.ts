/**
 * Legal-basis chain (#2): extract the authorising section(s) from a
 * sub-regulation's preamble — "อาศัยอำนาจตามความในมาตรา X แห่ง <parent act>" —
 * and store the section list on GazetteEntry.legalBasis (e.g. "มาตรา ๔, มาตรา ๔๒ (๑๗)").
 *
 * Only the section list is stored; the parent act is already known via actId,
 * so the UI renders "ออกตามความใน <legalBasis> แห่ง <act.shortName>".
 *
 * Source: DocumentText (the 50k Krisdika full texts). Gazette-only entries
 * (no full text) can be enriched later from the cached OCR PDFs.
 *
 * Usage: npx tsx scripts/extract-legal-basis.ts [--test] [limit]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AUTHORITY = "อาศัยอำนาจตามความใน";
// a single section token: มาตรา <num> [วรรค <ordinal>] [(sub)] (Thai/Arabic digits).
// วรรค is bounded to real ordinals — a greedy [ก-๛]+ runs away in the old
// space-less gazette texts (e.g. "วรรคหนึ่งแห่งกฎอัยการศึกพระพุทธศักราช...").
const VARACK = "(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|[๐-๙0-9]+)";
const SECTION_RE = new RegExp(
  `มาตรา\\s*[๐-๙0-9]+(?:/[๐-๙0-9]+)?(?:\\s*วรรค${VARACK})?(?:\\s*\\([๐-๙0-9ก-๛]+\\))?`,
  "g"
);

// Extract the cleaned section list from a document's text, or null.
export function extractLegalBasis(rawText: string): string | null {
  // normalise the decomposed sara-am (ํา → ำ) that many Krisdika texts use —
  // otherwise "อาศัยอำนาจ" is not found in e.g. revenue-code announcements
  const text = rawText.replace(/ํา/g, "ำ").replace(/\\_/g, "").replace(/\s+/g, " ");
  const start = text.indexOf(AUTHORITY);
  if (start < 0) return null;
  let window = text.slice(start + AUTHORITY.length, start + AUTHORITY.length + 240);
  // the section list always precedes the parent act ("แห่ง ...") or,
  // for คสช. orders, "ของรัฐธรรมนูญ" — cut there to avoid later clauses
  const bounds = ["แห่ง", "ของรัฐธรรมนูญ"]
    .map((b) => window.indexOf(b))
    .filter((i) => i >= 0);
  if (bounds.length) window = window.slice(0, Math.min(...bounds));
  // authority clause must start with a section reference (avoid false hits)
  if (!/^\s*มาตรา/.test(window)) return null;
  const sections = window.match(SECTION_RE);
  if (!sections?.length) return null;
  // dedupe, normalise spacing, cap length
  const seen = new Set<string>();
  const list = sections
    .map((s) => s.replace(/\s+/g, " ").replace(/\(\s*/g, " (").replace(/\s*\)/g, ")").trim())
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .slice(0, 8);
  return list.join(", ");
}

async function main() {
  const test = process.argv.includes("--test");
  const limit = process.argv.find((a) => /^\d+$/.test(a));
  const take = limit ? parseInt(limit, 10) : test ? 12 : undefined;

  // candidate entry ids first (cheap — no text), then fetch texts in batches
  // to avoid loading thousands of multi-MB documents into memory at once.
  const candidates = await prisma.gazetteEntry.findMany({
    // filter on sara-am-free "อาศัย" so decomposed texts (ํา) are caught too;
    // the extractor then validates the full "อาศัยอำนาจตามความใน" clause
    where: { legalBasis: null, documentText: { text: { contains: "อาศัย" } } },
    select: { id: true, title: true, act: { select: { shortName: true } } },
    take,
  });
  console.log(`${candidates.length} candidate entries`);

  let found = 0,
    done = 0;
  const BATCH = 300;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH);
    const texts = await prisma.documentText.findMany({
      where: { entryId: { in: slice.map((c) => c.id) } },
      select: { entryId: true, text: true },
    });
    const textById = new Map(texts.map((t) => [t.entryId, t.text]));
    for (const c of slice) {
      done++;
      const basis = extractLegalBasis(textById.get(c.id) ?? "");
      if (!basis) continue;
      found++;
      if (test) {
        console.log(`\n${c.title.slice(0, 70)}`);
        console.log(`  → ออกตามความใน ${basis}${c.act ? ` แห่ง${c.act.shortName}` : ""}`);
      } else {
        await prisma.gazetteEntry.update({ where: { id: c.id }, data: { legalBasis: basis } });
      }
    }
    if (!test) console.log(`  ${done}/${candidates.length} processed, ${found} with legal basis`);
  }
  console.log(`\n${test ? "TEST — " : ""}${found}/${done} extracted a legal basis`);
  await prisma.$disconnect();
}

// only self-run when invoked directly (not when imported for its extractor)
if (process.argv[1]?.includes("extract-legal-basis")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
