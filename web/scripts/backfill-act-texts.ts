/**
 * Backfill readable primary texts for acts that have none (user report:
 * พ.ร.บ.สภาตำบลฯ ๒๕๓๗ — 1,739 sub-regulations but no parent text; audit found
 * 904 such acts).
 *
 * Source: the same verified OCS pipeline as import-code-texts.ts —
 *   1. page www.ocs.go.th/searchlaw/indexs/list_table_search (tab_type=law)
 *      to index every law's officially-encrypted timeline id,
 *   2. match index names against our actless Act rows (exact normalized-name
 *      equality only — no fuzzy guessing),
 *   3. getPublicLawDoc per match → primary GazetteEntry (pdfUrl "ocs:<lawCode>")
 *      + DocumentText + exact searchlaw permalink Source.
 * Every imported text is name-checked against the API's own lawInfo before
 * anything is written.
 *
 * Usage: npx tsx scripts/backfill-act-texts.ts [--dry] [--limit N] [--index file.json]
 *        (--index: a pre-fetched law index — www.ocs.go.th serves an
 *         incomplete TLS chain that Node's fetch rejects, so page the index
 *         with curl/python and pass the JSON here; searchlaw.ocs.go.th, where
 *         the actual texts come from, verifies fine)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

const LIST_URL = "https://www.ocs.go.th/searchlaw/indexs/list_table_search";
const API_URL = "https://searchlaw.ocs.go.th/ocs-api/public/doc/getLawDoc";
const DOC_URL = "https://searchlaw.ocs.go.th/council-of-state/#/public/doc/";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
function compact(s: string): string {
  return s
    .replace(/ํา/g, "ำ")
    .replace(/\(ยกเลิก\)\s*$/, "")
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/\s+/g, "");
}

interface OcsLaw {
  lawCode: string;
  name: string;
  enc: string;
}

async function fetchIndex(): Promise<OcsLaw[]> {
  const out: OcsLaw[] = [];
  for (let page = 1; ; page++) {
    const body = new URLSearchParams({
      "query[tab_type]": "law",
      "query[type_view]": "law",
      "pagination[page]": String(page),
      "pagination[perpage]": "100",
    });
    const res = await fetch(LIST_URL, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest", "User-Agent": "Mozilla/5.0" },
      body,
    });
    const d = (await res.json()) as { meta: { total: number }; data: any[] };
    for (const x of d.data ?? []) {
      if (x.lawNameTh && x.encTimelineID)
        out.push({ lawCode: x.lawCode, name: x.lawNameTh, enc: x.encTimelineID });
    }
    if (out.length >= d.meta.total || !d.data?.length) return out;
    await new Promise((r) => setTimeout(r, 800));
  }
}

interface LawDoc {
  lawInfo: { lawNameTh: string; publishDateAd: string | null };
  lawSections: { sectionSeq: number; sectionContent: string | null }[];
}

async function fetchLawDoc(enc: string): Promise<LawDoc | null> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      reqHeader: {
        reqId: Date.now().toString(),
        reqChannel: "WEB",
        reqDtm: new Date().toISOString().slice(0, 23).replace("T", " "),
        reqBy: "unknow",
        serviceName: "getPublicLawDoc",
        uuid: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
      },
      reqBody: { isTransEng: false, timelineId: enc },
    }),
  });
  const data = (await res.json()) as { respHeader: { errorCode: string }; respBody?: LawDoc };
  if (data.respHeader.errorCode !== "SUCCESS" || !data.respBody?.lawSections?.length) return null;
  return data.respBody;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&ensp;": " ", "&emsp;": " ", "&amp;": "&",
  "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
};
function flatten(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
    .replace(/ํา/g, "ำ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}
function docText(doc: LawDoc): string {
  const parts: string[] = [];
  for (const s of [...doc.lawSections].sort((a, b) => a.sectionSeq - b.sectionSeq)) {
    const t = flatten(s.sectionContent ?? "");
    if (t && t !== "..") parts.push(t);
  }
  return parts.join("\n\n");
}

async function main() {
  const dry = process.argv.includes("--dry");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

  const indexArg = process.argv.indexOf("--index");
  let index: OcsLaw[];
  if (indexArg >= 0) {
    index = (JSON.parse(readFileSync(process.argv[indexArg + 1], "utf8")) as any[]).map((o) => ({
      lawCode: o.lawCode,
      name: o.name ?? o.lawNameTh,
      enc: o.enc ?? o.encTimelineID,
    }));
  } else {
    console.log("paging OCS law index...");
    index = await fetchIndex();
  }
  const byName = new Map(index.map((o) => [compact(o.name), o]));
  console.log(`${index.length} laws in the OCS index`);

  const actless = await prisma.act.findMany({
    where: {
      actType: { in: ["พระราชบัญญัติ", "พระราชกำหนด", "พระราชบัญญัติประกอบรัฐธรรมนูญ"] },
      entries: { none: { isPrimary: true } },
    },
    select: { id: true, fullName: true },
  });
  console.log(`${actless.length} acts without a primary text`);

  let done = 0, imported = 0, failed = 0;
  for (const act of actless) {
    if (imported >= limit) break;
    const key = compact(act.fullName);
    // registry rows parsed from sub-reg titles sometimes carry a second,
    // spurious year ("...พุทธศักราช 2485 พ.ศ. 2530") — try with it stripped
    const deDoubled = act.fullName.match(
      /^(.*(?:พ\.ศ\.|พุทธศักราช)\s*[๐-๙0-9]{4})\s*(?:พ\.ศ\.|พุทธศักราช)\s*[๐-๙0-9]{4}$/,
    )?.[1];
    const hit =
      byName.get(key) ??
      byName.get(key.replace("พ.ศ.", "พุทธศักราช")) ??
      (deDoubled ? byName.get(compact(deDoubled)) : undefined) ??
      (deDoubled ? byName.get(compact(deDoubled).replace("พ.ศ.", "พุทธศักราช")) : undefined);
    if (!hit) continue;
    done++;
    const doc = await fetchLawDoc(hit.enc);
    // the API's own record must name the same act — never import a mismatch
    if (!doc || compact(doc.lawInfo.lawNameTh) !== compact(hit.name)) {
      failed++;
      console.log(`  ✗ ${act.fullName.slice(0, 60)} (${doc ? "name mismatch" : "fetch failed"})`);
      continue;
    }
    const text = docText(doc);
    const url = `${DOC_URL}${hit.enc}`;
    console.log(`  ✓ ${act.fullName.slice(0, 60)} — ${text.length.toLocaleString()} chars`);
    imported++;
    if (dry) continue;

    const entryData = {
      title: act.fullName,
      origin: "ocs",
      sourceUrl: url,
      isPrimary: true,
      isAmendment: false,
      actId: act.id,
      linkSource: "title" as const,
      publishedAt: doc.lawInfo.publishDateAd ? new Date(doc.lawInfo.publishDateAd) : null,
      volume: 0,
      issue: "",
      category: "",
      page: 0,
    };
    const entry = await prisma.gazetteEntry.upsert({
      where: { pdfUrl: `ocs:${hit.lawCode}` },
      create: { pdfUrl: `ocs:${hit.lawCode}`, ...entryData },
      update: entryData,
    });
    await prisma.documentText.upsert({
      where: { entryId: entry.id },
      create: { entryId: entry.id, text },
      update: { text },
    });
    await prisma.source.upsert({
      where: { actId_url: { actId: act.id, url } },
      create: {
        actId: act.id,
        url,
        title: `ตัวบท${act.fullName} ฉบับปรับปรุงล่าสุด (ระบบค้นหากฎหมาย)`,
        publisher: "สำนักงานคณะกรรมการกฤษฎีกา",
      },
      update: {},
    });
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`\n${dry ? "DRY — " : ""}matched ${done}, imported ${imported}, failed ${failed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
