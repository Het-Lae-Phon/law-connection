/**
 * Attach real Krisdika law-library reference URLs to imported library entries,
 * using the PyThaiNLP/thai-law URL mappings:
 *   data/thailaw/law_item_urls.csv — sub-law title -> librarian/get?sysid=... URL
 *   data/thailaw/law_url_df.csv    — act title -> full-text URL + sub-law listing URL
 *
 * Matching is by normalized title and only applied when unambiguous (a title
 * that maps to multiple different URLs is skipped — wrong reference is worse
 * than none). Act matches are also seeded as authoritative Sources.
 *
 * ⚠️ DISABLED — DO NOT RUN until OCS deep-linking is solved.
 *
 * History: the CSVs carry the old krisdika.go.th/librarian/get?sysid=N URLs,
 * which are dead (site moved to ocs.go.th). We then tried
 *   https://searchlaw.ocs.go.th/council-of-state/#/public/doc/<sysid>
 * but the OCS app AES-encrypts its route parameters, so plain-sysid links fail
 * with PDL_CIPHER_EXCEPTION (confirmed in production on 2026-07-02). There is
 * currently NO stable public deep-link scheme for OCS documents. Entries rely
 * on the built-in full-text reader (/doc/[id]) instead; revisit if OCS ships a
 * public API or shareable permalinks.
 *
 * Usage: npx tsx scripts/link-krisdika-urls.ts --i-know-links-are-broken
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const DATA = path.join(__dirname, "..", "..", "data", "thailaw");

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

// old librarian URL -> current OCS searchlaw deep link (null if not mappable)
function toSearchlawUrl(oldUrl: string): string | null {
  const m = oldUrl.match(/[?&]sysid=(\d+)/);
  return m ? `https://searchlaw.ocs.go.th/council-of-state/#/public/doc/${m[1]}` : null;
}

// minimal RFC-4180 CSV parser (titles contain commas, so fields are quoted)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  if (!process.argv.includes("--i-know-links-are-broken")) {
    console.error(
      "refusing to run: searchlaw.ocs.go.th deep links fail with PDL_CIPHER_EXCEPTION " +
        "(route params are encrypted). See the header comment of this script."
    );
    process.exit(1);
  }
  // --- sub-law items: title -> url (unambiguous only)
  const itemRows = parseCsv(fs.readFileSync(path.join(DATA, "law_item_urls.csv"), "utf8"));
  const itemHeader = itemRows[0];
  const nameIdx = itemHeader.indexOf("item_name");
  const urlIdx = itemHeader.indexOf("item_url");
  const urlsByTitle = new Map<string, Set<string>>();
  for (const r of itemRows.slice(1)) {
    const key = compact(r[nameIdx] ?? "");
    const url = toSearchlawUrl((r[urlIdx] ?? "").trim());
    if (!key || !url) continue;
    if (!urlsByTitle.has(key)) urlsByTitle.set(key, new Set());
    urlsByTitle.get(key)!.add(url);
  }
  let ambiguous = 0;
  const urlByTitle = new Map<string, string>();
  for (const [k, set] of urlsByTitle) {
    if (set.size === 1) urlByTitle.set(k, [...set][0]);
    else ambiguous++;
  }
  console.log(`item mapping: ${urlByTitle.size} unambiguous titles (${ambiguous} ambiguous skipped)`);

  const entries = await prisma.gazetteEntry.findMany({
    where: { origin: "krisdika", sourceUrl: null },
    select: { id: true, title: true },
  });
  let linked = 0;
  for (const e of entries) {
    const url = urlByTitle.get(compact(e.title));
    if (!url) continue;
    await prisma.gazetteEntry.update({ where: { id: e.id }, data: { sourceUrl: url } });
    linked++;
  }
  console.log(`entries: ${linked}/${entries.length} linked to Krisdika URLs`);

  // --- acts: seed authoritative sources (consolidated text + Krisdika's own sub-law list)
  const actRows = parseCsv(fs.readFileSync(path.join(DATA, "law_url_df.csv"), "utf8"));
  const ah = actRows[0];
  const at = ah.indexOf("title"), au = ah.indexOf("law_url"), asub = ah.indexOf("sub_law_url");
  const actUrl = new Map<string, { lawUrl: string; subUrl: string }>();
  for (const r of actRows.slice(1)) {
    const key = compact(r[at] ?? "");
    if (key) actUrl.set(key, { lawUrl: (r[au] ?? "").trim(), subUrl: (r[asub] ?? "").trim() });
  }

  const acts = await prisma.act.findMany();
  let seeded = 0;
  for (const a of acts) {
    // CSV titles often carry "(ฉบับ Update ล่าสุด)" or lack the year — try both forms
    const keys = [compact(a.fullName), compact(`${a.actType}${a.shortName}`)];
    let hit: { lawUrl: string; subUrl: string } | undefined;
    for (const k of keys) {
      hit = actUrl.get(k) ?? actUrl.get(k + compact("(ฉบับ Update ล่าสุด)"));
      if (hit) break;
    }
    if (!hit) continue;
    const lawUrl = toSearchlawUrl(hit.lawUrl);
    if (lawUrl) {
      await prisma.source.upsert({
        where: { actId_url: { actId: a.id, url: lawUrl } },
        create: {
          actId: a.id,
          url: lawUrl,
          title: "ฉบับปรับปรุงล่าสุด (ระบบค้นหากฎหมาย สำนักงานคณะกรรมการกฤษฎีกา)",
          publisher: "สำนักงานคณะกรรมการกฤษฎีกา",
          contributor: "ระบบนำเข้าอัตโนมัติ",
        },
        update: {},
      });
      seeded++;
    }
    // hit.subUrl uses the retired law?lawcode= scheme — no working equivalent known
  }
  console.log(`acts: seeded Krisdika sources for ${seeded} acts`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
