/**
 * Refresh Act / GazetteEntry / Source from an updated friend snapshot, without
 * ever deleting rows — upserts by id (insert new, update existing on conflict).
 * DocumentText and Contribution are untouched: DocumentText has an
 * ON DELETE RESTRICT FK from GazetteEntry (a delete-and-reload would fail on
 * any entry with full text), and Contribution holds real
 * community/seed activity that isn't part of the content pipeline.
 *
 * Prep: same sqlite3 json_object export as migrate-friend-snapshot.mjs, for
 * act.jsonl / gazette_entry.jsonl / source.jsonl only (skip document_text,
 * contribution).
 *
 * Usage: node --env-file=.env scripts/update-from-snapshot.mjs <dir-with-jsonl-files>
 */
import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import { createInterface } from "readline";

const prisma = new PrismaClient();
const DIR = process.argv[2];
if (!DIR) {
  console.error("Usage: node --env-file=.env scripts/update-from-snapshot.mjs <dir-with-jsonl-files>");
  process.exit(1);
}

function toBool(v) {
  return v === 1 || v === true;
}
function toDate(v) {
  return v ? new Date(v) : null;
}

async function upsertBatch(table, columns, rows) {
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const updateSet = columns
    .filter((c) => c !== "id")
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");
  const valuesSql = [];
  const params = [];
  let idx = 1;
  for (const row of rows) {
    valuesSql.push(`(${columns.map(() => `$${idx++}`).join(", ")})`);
    for (const c of columns) params.push(row[c]);
  }
  const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valuesSql.join(", ")}
    ON CONFLICT (id) DO UPDATE SET ${updateSet}`;
  await prisma.$executeRawUnsafe(sql, ...params);
}

async function upsertBatched(file, table, columns, batchSize, transform) {
  const rl = createInterface({ input: createReadStream(`${DIR}/${file}`), crlfDelay: Infinity });
  let batch = [];
  let total = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    batch.push(transform(JSON.parse(line)));
    if (batch.length >= batchSize) {
      await upsertBatch(table, columns, batch);
      total += batch.length;
      process.stdout.write(`\r${file}: ${total}`);
      batch = [];
    }
  }
  if (batch.length) {
    await upsertBatch(table, columns, batch);
    total += batch.length;
  }
  console.log(`\r${file}: ${total} done`);
}

async function updateSelfRef(file, table, idField, refField) {
  const rl = createInterface({ input: createReadStream(`${DIR}/${file}`), crlfDelay: Infinity });
  let total = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r[refField]) {
      await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET "${refField}" = $1 WHERE "${idField}" = $2`,
        r[refField],
        r[idField]
      );
      total++;
    }
  }
  if (total) console.log(`${file}: ${total} ${refField} backfilled`);
}

async function main() {
  await upsertBatched(
    "act.jsonl",
    "Act",
    ["id", "slug", "actType", "shortName", "year", "fullName", "status"],
    500,
    (r) => ({ ...r, status: r.status ?? "active" })
  );
  // repealedById is self-referencing — a row's target may not exist yet
  // within the same upsert pass, so backfill it in a second pass once every
  // Act row is guaranteed to exist.
  await updateSelfRef("act.jsonl", "Act", "id", "repealedById");

  await upsertBatched(
    "gazette_entry.jsonl",
    "GazetteEntry",
    [
      "id",
      "title",
      "publishedAt",
      "volume",
      "issue",
      "category",
      "page",
      "origin",
      "pdfUrl",
      "sourceUrl",
      "instrumentType",
      "isPrimary",
      "isAmendment",
      "actId",
      "linkSource",
      "verifyStatus",
      "legalBasis",
    ],
    500,
    (r) => ({
      ...r,
      publishedAt: toDate(r.publishedAt),
      isPrimary: toBool(r.isPrimary),
      isAmendment: toBool(r.isAmendment),
    })
  );
  // revokedById — same self-reference concern as Act.repealedById
  await updateSelfRef("gazette_entry.jsonl", "GazetteEntry", "id", "revokedById");

  await upsertBatched(
    "source.jsonl",
    "Source",
    ["id", "actId", "title", "url", "publisher", "contributor", "createdAt"],
    500,
    (r) => ({ ...r, createdAt: toDate(r.createdAt) ?? new Date() })
  );

  for (const [table, col] of [
    ["Act", "id"],
    ["GazetteEntry", "id"],
    ["Source", "id"],
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
