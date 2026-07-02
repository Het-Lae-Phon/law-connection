/**
 * Correct publishedAt for PDPC-imported entries: the original import trusted a
 * date found in the WordPress page (often a boilerplate date). Re-derive the
 * date from the regulation PDF's promulgation line ("ประกาศ ณ วันที่ ...");
 * entries whose PDF yields no date are set to null (shown as "ไม่ระบุวันที่")
 * rather than kept wrong.
 *
 * Usage: npx tsx scripts/fix-pdpc-dates.ts
 */
import { PrismaClient } from "@prisma/client";
import { extractPdfDate } from "./pdf-date";

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.gazetteEntry.findMany({ where: { origin: "pdpc" } });
  console.log(`checking ${entries.length} PDPC entries`);
  let fixed = 0, cleared = 0, unchanged = 0;
  for (const e of entries) {
    const d = await extractPdfDate(e.pdfUrl);
    const oldStr = e.publishedAt?.toISOString().slice(0, 10) ?? "null";
    const newStr = d?.toISOString().slice(0, 10) ?? "null";
    if (oldStr === newStr) {
      unchanged++;
      continue;
    }
    await prisma.gazetteEntry.update({ where: { id: e.id }, data: { publishedAt: d } });
    console.log(`  #${e.id} ${oldStr} -> ${newStr}  ${e.title.slice(0, 60)}`);
    d ? fixed++ : cleared++;
  }
  console.log(`fixed ${fixed}, cleared-to-null ${cleared}, already correct ${unchanged}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
