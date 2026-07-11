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
// A qualifier names which instrument the section run *before* it belongs to:
// "...มาตรา ๔ แห่งพระราชบัญญัติ X" / "...มาตรา ๑๗๕ ของรัฐธรรมนูญ". The instrument
// name that follows is read by slicing (not consumed) so a greedy match can't
// swallow the *next* qualifier in a multi-instrument preamble.
const QUALIFIER_RE =
  /(แห่ง|ของ)\s*(รัฐธรรมนูญ|พระราชบัญญัติประกอบรัฐธรรมนูญ|พระราชบัญญัติ|พระราชกำหนด|พระราชกฤษฎีกา|ประมวล\S*|กฎ\S*|ประกาศ\S*|ระเบียบ\S*|ข้อบังคับ\S*|คำสั่ง\S*)/g;
// the operative part begins here — never read section refs past this point
const OPERATIVE =
  /จึง|ดังต่อไปนี้|ให้ไว้|ให้ตรา|ออกกฎ|ออกประกาศ|ออกระเบียบ|ออกข้อบังคับ|ประกาศไว้|จึงออก|โปรดเกล้า/;

/**
 * Extract the authorising section(s) of the PARENT act from a preamble.
 *
 * A preamble may cite several instruments — e.g. a royal decree opens with
 * "มาตรา ๑๗๕ ของรัฐธรรมนูญ ... และมาตรา ๔ แห่งพระราชบัญญัติคุ้มครองข้อมูล ...".
 * Only the sections attached to the parent act belong on the entry, so we
 * attribute each section run to the instrument named in the qualifier that
 * follows it and drop รัฐธรรมนูญ sections (unless the parent IS the
 * constitution). Pure emergency decrees issued solely under the constitution
 * therefore yield null — they are not "issued under a section of" the act
 * they happen to amend.
 */
export function extractLegalBasis(
  rawText: string,
  isConstitutionParent = false,
  parentName?: string
): string | null {
  // normalise the decomposed sara-am (ํา → ำ) that many Krisdika texts use —
  // otherwise "อาศัยอำนาจ" is not found in e.g. revenue-code announcements
  const text = rawText.replace(/ํา/g, "ำ").replace(/\\_/g, "").replace(/\s+/g, " ");
  const start = text.indexOf(AUTHORITY);
  if (start < 0) return null;
  let clause = text.slice(start + AUTHORITY.length, start + AUTHORITY.length + 400);
  const op = clause.search(OPERATIVE);
  if (op > 0) clause = clause.slice(0, op);
  // authority clause must start with a section reference (avoid false hits)
  if (!/^\s*มาตรา/.test(clause)) return null;

  // when the parent act's name is known, only the section run whose qualifier
  // names that act counts — a preamble often cites another instrument too
  // (e.g. PDPA announcement: "มาตรา ๔ แห่ง พ.ร.บ.คุ้มครองฯ ประกอบมาตรา ๕ แห่ง
  //  พระราชกฤษฎีกา..." → only มาตรา ๔ belongs to the PDPA).
  const pName = parentName?.replace(/ํา/g, "ำ").replace(/\s+/g, "").trim();
  const quals = [...clause.matchAll(QUALIFIER_RE)].map((m) => ({
    index: m.index!,
    isConstitution: m[2].startsWith("รัฐธรรมนูญ"),
    // read ~45 chars of the instrument name by slicing (not consuming), spaces
    // stripped, so the parent act can be matched by name
    name: clause.slice(m.index!, m.index! + 45).replace(/ํา/g, "ำ").replace(/\s+/g, ""),
  }));
  const matchesParent = pName && pName.length >= 4
    ? quals.some((q) => q.name.includes(pName))
    : false;

  const seen = new Set<string>();
  const kept: string[] = [];
  let cursor = 0;
  for (const q of quals) {
    const segment = clause.slice(cursor, q.index);
    cursor = q.index;
    // if we can pin the parent act by name, take only its section run;
    // otherwise fall back to "every non-constitution instrument"
    if (matchesParent) {
      if (!q.name.includes(pName!)) continue;
    } else if (q.isConstitution && !isConstitutionParent) {
      continue;
    }
    for (const s of segment.match(SECTION_RE) ?? []) {
      const c = s
        .replace(/มาตรา(?=[๐-๙0-9])/, "มาตรา ") // OCR sometimes drops the space
        .replace(/\s*\(\s*/g, " (")
        .replace(/\s*\)/g, ")")
        .replace(/\s+/g, " ")
        .trim();
      if (!seen.has(c)) (seen.add(c), kept.push(c));
    }
  }
  if (kept.length === 0) return null;
  return kept.slice(0, 8).join(", ");
}

async function main() {
  const test = process.argv.includes("--test");
  // --recompute reprocesses every entry with an authority clause and overwrites
  // the stored basis (including clearing values that were mis-attributed to the
  // constitution before the parent-act attribution fix).
  const recompute = process.argv.includes("--recompute");
  const limit = process.argv.find((a) => /^\d+$/.test(a));
  const take = limit ? parseInt(limit, 10) : test ? 12 : undefined;

  // candidate entry ids first (cheap — no text), then fetch texts in batches
  // to avoid loading thousands of multi-MB documents into memory at once.
  const candidates = await prisma.gazetteEntry.findMany({
    // filter on sara-am-free "อาศัย" so decomposed texts (ํา) are caught too;
    // the extractor then validates the full "อาศัยอำนาจตามความใน" clause
    where: {
      ...(recompute ? {} : { legalBasis: null }),
      documentText: { text: { contains: "อาศัย" } },
    },
    select: { id: true, title: true, legalBasis: true, act: { select: { shortName: true, actType: true } } },
    take,
  });
  console.log(`${candidates.length} candidate entries`);

  let found = 0,
    cleared = 0,
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
      const basis = extractLegalBasis(
        textById.get(c.id) ?? "",
        c.act?.actType === "รัฐธรรมนูญ",
        c.act?.shortName
      );
      if (basis) found++;
      if (test) {
        if (basis) {
          console.log(`\n${c.title.slice(0, 70)}`);
          console.log(`  → ออกตามความใน ${basis}${c.act ? ` แห่ง${c.act.shortName}` : ""}`);
        }
      } else if (recompute) {
        // overwrite only when the value actually changes
        if ((c.legalBasis ?? null) !== (basis ?? null)) {
          if (!basis && c.legalBasis) cleared++;
          await prisma.gazetteEntry.update({ where: { id: c.id }, data: { legalBasis: basis } });
        }
      } else if (basis) {
        await prisma.gazetteEntry.update({ where: { id: c.id }, data: { legalBasis: basis } });
      }
    }
    if (!test) console.log(`  ${done}/${candidates.length} processed, ${found} with basis${recompute ? `, ${cleared} cleared` : ""}`);
  }
  console.log(`\n${test ? "TEST — " : ""}${found}/${done} have a legal basis${recompute ? ` (${cleared} mis-attributed values cleared)` : ""}`);
  await prisma.$disconnect();
}

// only self-run when invoked directly (not when imported for its extractor)
if (process.argv[1]?.includes("extract-legal-basis")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
