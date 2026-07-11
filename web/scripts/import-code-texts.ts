/**
 * ประมวลกฎหมาย: exact source links + readable full text.
 *
 * The OCS "ระบบค้นหากฎหมาย" SPA has no plain permalinks, but its backend
 * exposes the officially-encrypted timeline IDs via
 *   POST https://www.ocs.go.th/searchlaw/indexs/list_table_search
 *   (query[tab_type]=law, query[lawCategoryName]=1D → the 8 codes)
 * and serves the full consolidated text via
 *   POST https://searchlaw.ocs.go.th/ocs-api/public/doc/getLawDoc
 *   serviceName=getPublicLawDoc, reqBody {isTransEng:false, timelineId:<enc>}.
 *
 * The enc IDs below were taken from that endpoint on 2026-07-10 and each
 * getPublicLawDoc call was verified to return the named code with its
 * sections (e.g. ปพพ. = 2,254 sections). The public page for an enc ID is
 *   https://searchlaw.ocs.go.th/council-of-state/#/public/doc/<enc>
 * — the same link format the OCS site itself renders, and the format the
 * team confirmed working (ปพพ. enc matches the link they shared).
 *
 * For each code this script:
 *  1. fetches the consolidated text and flattens it to plain text,
 *  2. upserts a primary GazetteEntry (pdfUrl "ocs:<lawCode>") on the act row
 *     with the most linked entries + a DocumentText so the code is readable
 *     at /doc/[id],
 *  3. replaces the generic ?tab=law5 Source on every matching act row with
 *     the exact per-code link.
 *
 * Usage: npx tsx scripts/import-code-texts.ts [--dry]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DOC_URL = "https://searchlaw.ocs.go.th/council-of-state/#/public/doc/";
const API_URL = "https://searchlaw.ocs.go.th/ocs-api/public/doc/getLawDoc";

// verified 2026-07-10 against list_table_search (lawCategoryName=1D, total=8)
const CODES = [
  { lawCode: "ป0002-1D-0001", enc: "KytlTGlrQzIrQlpQcWxZYWl2cm5IUT09", fullName: "ประมวลกฎหมายที่ดิน", shortName: "ที่ดิน" },
  { lawCode: "ป0003-1D-0002", enc: "Qko1NGNVa1FhMG9hTTNGcU9sTGxydz09", fullName: "ประมวลกฎหมายแพ่งและพาณิชย์", shortName: "แพ่งและพาณิชย์" },
  { lawCode: "ป0004-1D-0001", enc: "VjZQcUR4VG1iVHZGS09TMUMvY2Vsdz09", fullName: "ประมวลกฎหมายวิธีพิจารณาความแพ่ง", shortName: "วิธีพิจารณาความแพ่ง" },
  { lawCode: "ป0005-1D-0001", enc: "UVdzUTNzUFZlT3VBOEw2allVWTZxZz09", fullName: "ประมวลกฎหมายวิธีพิจารณาความอาญา", shortName: "วิธีพิจารณาความอาญา" },
  { lawCode: "ป0006-1D-0003", enc: "K2dTMURyaDllOXJVWVZqZGJLK09pdz09", fullName: "ประมวลกฎหมายอาญา", shortName: "อาญา" },
  { lawCode: "ป0007-1D-0008", enc: "OXJVYVFMVG9ZWnRWK2tpZTlWaUp5dz09", fullName: "ประมวลกฎหมายอาญาทหาร", shortName: "อาญาทหาร" },
  { lawCode: "ป0008-1D-0001", enc: "UlRsZkRZZGI0RkVYeUh3ZEFyaS9tUT09", fullName: "ประมวลรัษฎากร", shortName: "รัษฎากร" },
  { lawCode: "ป0060-1D-0001", enc: "c3E0Y2pIRFNJMW4vRWwwQStER0hoQT09", fullName: "ประมวลกฎหมายยาเสพติด", shortName: "ยาเสพติด" },
];

interface LawSection {
  sectionSeq: number;
  sectionLabel: string | null;
  sectionContent: string | null;
}

async function fetchLawDoc(enc: string) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      reqHeader: {
        reqId: Date.now().toString(),
        reqChannel: "WEB",
        reqDtm: new Date().toISOString().slice(0, 23).replace("T", " "),
        reqBy: "unknow", // literal value the SPA sends for anonymous users
        serviceName: "getPublicLawDoc",
        uuid: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
      },
      reqBody: { isTransEng: false, timelineId: enc },
    }),
  });
  const data = (await res.json()) as {
    respHeader: { errorCode: string; errorDesc: string };
    respBody?: {
      lawInfo: { lawNameTh: string; publishDateAd: string | null };
      lawSections: LawSection[];
    };
  };
  if (data.respHeader.errorCode !== "SUCCESS" || !data.respBody?.lawSections?.length) {
    throw new Error(`getPublicLawDoc failed: ${data.respHeader.errorCode} ${data.respHeader.errorDesc}`);
  }
  return data.respBody;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&ensp;": " ", "&emsp;": " ", "&amp;": "&",
  "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
};

// section HTML → plain text (one paragraph per <p>, tags stripped)
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

function codeText(sections: LawSection[]): string {
  const parts: string[] = [];
  for (const s of [...sections].sort((a, b) => a.sectionSeq - b.sectionSeq)) {
    const t = flatten(s.sectionContent ?? "");
    if (t && t !== "..") parts.push(t);
  }
  return parts.join("\n\n");
}

async function main() {
  const dry = process.argv.includes("--dry");

  for (const code of CODES) {
    const url = `${DOC_URL}${code.enc}`;
    const doc = await fetchLawDoc(code.enc);
    if (doc.lawInfo.lawNameTh !== code.fullName) {
      throw new Error(`name mismatch for ${code.lawCode}: got ${doc.lawInfo.lawNameTh}`);
    }
    const text = codeText(doc.lawSections);
    console.log(`${code.fullName}: ${doc.lawSections.length} sections, ${text.length.toLocaleString()} chars`);
    if (dry) continue;

    // all registry rows for this code (duplicates included until merged)
    let rows = await prisma.act.findMany({
      where: { actType: "ประมวลกฎหมาย", shortName: code.shortName },
      select: { id: true, _count: { select: { entries: true } } },
    });
    if (rows.length === 0) {
      const created = await prisma.act.create({
        data: {
          slug: `ประมวลกฎหมาย-${code.shortName}`,
          actType: "ประมวลกฎหมาย",
          shortName: code.shortName,
          fullName: code.fullName,
        },
      });
      rows = [{ id: created.id, _count: { entries: 0 } }];
      console.log(`  created act row ${created.id}`);
    }
    // the code text lives on the row sub-regulations actually link to
    const main = rows.reduce((a, b) => (b._count.entries > a._count.entries ? b : a));

    const entryData = {
      title: code.fullName,
      origin: "ocs",
      sourceUrl: url,
      isPrimary: true,
      isAmendment: false,
      actId: main.id,
      linkSource: "title" as const,
      publishedAt: doc.lawInfo.publishDateAd ? new Date(doc.lawInfo.publishDateAd) : null,
      volume: 0,
      issue: "",
      category: "",
      page: 0,
    };
    const entry = await prisma.gazetteEntry.upsert({
      where: { pdfUrl: `ocs:${code.lawCode}` },
      create: { pdfUrl: `ocs:${code.lawCode}`, ...entryData },
      update: entryData,
    });
    await prisma.documentText.upsert({
      where: { entryId: entry.id },
      create: { entryId: entry.id, text },
      update: { text },
    });

    for (const row of rows) {
      await prisma.source.deleteMany({
        where: { actId: row.id, url: { contains: "tab=law5" } },
      });
      await prisma.source.upsert({
        where: { actId_url: { actId: row.id, url } },
        create: {
          actId: row.id,
          url,
          title: `ตัวบท${code.fullName} ฉบับปรับปรุงล่าสุด (ระบบค้นหากฎหมาย)`,
          publisher: "สำนักงานคณะกรรมการกฤษฎีกา",
        },
        update: { title: `ตัวบท${code.fullName} ฉบับปรับปรุงล่าสุด (ระบบค้นหากฎหมาย)` },
      });
    }
    console.log(`  entry ${entry.id} on act ${main.id}; exact source on ${rows.length} row(s)`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
