/**
 * One-off migration: load a SQLite snapshot into the Postgres DATABASE_URL,
 * preserving row IDs, then advance Postgres's autoincrement sequences past
 * the max ID used (since explicit IDs bypass the sequence on insert).
 *
 * Prep (sqlite3 CLI, one export per table, run before this script) — export
 * each table to JSON-lines via json_object(), e.g.:
 *   sqlite3 snapshot.db "SELECT json_object('id', id, 'slug', slug, 'actType', actType,
 *     'shortName', shortName, 'year', year, 'fullName', fullName) FROM Act;" > act.jsonl
 *   (gazette_entry.jsonl, source.jsonl, document_text.jsonl, contribution.jsonl —
 *   field lists match the corresponding Prisma model)
 *
 * Usage: node --env-file=.env scripts/migrate-friend-snapshot.mjs <dir-with-jsonl-files>
 */
import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const prisma = new PrismaClient();
const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage: node --env-file=.env scripts/migrate-friend-snapshot.mjs <dir-with-jsonl-files>");
  process.exit(1);
}

async function loadBatched(file, batchSize, insertFn) {
  const rl = createInterface({ input: createReadStream(`${DIR}/${file}`), crlfDelay: Infinity });
  let batch = [];
  let total = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    batch.push(JSON.parse(line));
    if (batch.length >= batchSize) {
      await insertFn(batch);
      total += batch.length;
      process.stdout.write(`\r${file}: ${total}`);
      batch = [];
    }
  }
  if (batch.length) {
    await insertFn(batch);
    total += batch.length;
  }
  console.log(`\r${file}: ${total} done`);
}

function toBool(v) {
  return v === 1 || v === true;
}
function toDate(v) {
  return v ? new Date(v) : null;
}

async function main() {
  await loadBatched("act.jsonl", 500, (rows) =>
    prisma.act.createMany({
      data: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        actType: r.actType,
        shortName: r.shortName,
        year: r.year,
        fullName: r.fullName,
        status: r.status ?? "active",
        // repealedById set in a second pass — same-file self-references may
        // point at rows in later insert batches
      })),
      skipDuplicates: true,
    })
  );

  await loadBatched("act.jsonl", 500, async (rows) => {
    for (const r of rows) {
      if (r.repealedById) {
        await prisma.act.update({ where: { id: r.id }, data: { repealedById: r.repealedById } }).catch(() => {});
      }
    }
  });

  await loadBatched("gazette_entry.jsonl", 2000, (rows) =>
    prisma.gazetteEntry.createMany({
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        publishedAt: toDate(r.publishedAt),
        volume: r.volume,
        issue: r.issue,
        category: r.category,
        page: r.page,
        origin: r.origin,
        pdfUrl: r.pdfUrl,
        sourceUrl: r.sourceUrl,
        instrumentType: r.instrumentType,
        isPrimary: toBool(r.isPrimary),
        isAmendment: toBool(r.isAmendment),
        actId: r.actId,
        linkSource: r.linkSource,
        verifyStatus: r.verifyStatus,
        legalBasis: r.legalBasis,
        revokedById: r.revokedById ?? null,
      })),
      skipDuplicates: true,
    })
  );

  await loadBatched("source.jsonl", 500, (rows) =>
    prisma.source.createMany({
      data: rows.map((r) => ({
        id: r.id,
        actId: r.actId,
        title: r.title,
        url: r.url,
        publisher: r.publisher,
        contributor: r.contributor,
        createdAt: toDate(r.createdAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  await loadBatched("document_text.jsonl", 200, (rows) =>
    prisma.documentText.createMany({
      data: rows.map((r) => ({
        entryId: r.entryId,
        text: r.text,
      })),
      skipDuplicates: true,
    })
  );

  await loadBatched("contribution.jsonl", 500, (rows) =>
    prisma.contribution.createMany({
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        entryId: r.entryId,
        actId: r.actId,
        payload: r.payload,
        comment: r.comment,
        contributor: r.contributor,
        createdAt: toDate(r.createdAt) ?? new Date(),
        reviewedAt: toDate(r.reviewedAt),
      })),
      skipDuplicates: true,
    })
  );

  // explicit IDs were inserted directly, so Postgres's autoincrement sequences
  // are still at their default starting point — advance them past the max id
  // used, or the next app-generated insert will collide.
  for (const [table, col] of [
    ["Act", "id"],
    ["GazetteEntry", "id"],
    ["Source", "id"],
    ["Contribution", "id"],
  ]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), COALESCE((SELECT MAX("${col}") FROM "${table}"), 1))`
    );
  }

  console.log("Sequences reset. Done.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
