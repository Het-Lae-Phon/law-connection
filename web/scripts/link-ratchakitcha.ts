/**
 * Attach official Ratchakitcha PDF links to library entries using the Royal
 * Gazette Web Service (สำนักเลขาธิการคณะรัฐมนตรี):
 *   https://api.soc.go.th/webservice/api/rkjs/{page}/{limit}?bookNo=&part=&dateBegin=...
 *
 * The API requires a token (free registration at https://www2.soc.go.th —
 * see the manual on https://data.go.th/dataset/dataset_02_04). Provide it via:
 *   RKJ_TOKEN=... npx tsx scripts/link-ratchakitcha.ts [limit]
 *
 * For each library entry that has a gazette citation (เล่ม/ตอน/หน้า/วันที่) but
 * no working link, the script queries the API by book/part/date, matches the
 * returned records by page number + normalized title, and attaches the official
 * filePath. Only exact matches are attached; ambiguous results are skipped.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "https://api.soc.go.th/webservice/api/rkjs";
const TOKEN = process.env.RKJ_TOKEN;

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

interface ApiRecord {
  subject?: string;
  title?: string;
  bookNo?: string | number;
  part?: string | number;
  pageNo?: string | number;
  publishDate?: string;
  filePath?: string;
}

async function queryGazette(params: {
  bookNo: number;
  part: string;
  partExtra?: string;
  date: string; // DD-MM-YYYY (Gregorian, per the manual's examples)
}): Promise<ApiRecord[]> {
  const q = new URLSearchParams({
    bookNo: String(params.bookNo),
    part: params.part,
    dateBegin: params.date,
    dateEnd: params.date,
  });
  if (params.partExtra) q.set("partExtra", params.partExtra);
  const res = await fetch(`${API}/1/100?${q}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "User-Agent": "thai-law-portal/0.1 (open-source legal reference index)",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = (await res.json()) as ApiRecord[] | { data?: ApiRecord[] };
  return Array.isArray(data) ? data : (data.data ?? []);
}

function fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

async function main() {
  if (!TOKEN) {
    console.error(
      "RKJ_TOKEN is not set.\n\n" +
        "The Royal Gazette Web Service requires a (free) token:\n" +
        "  1. register / log in at https://www2.soc.go.th\n" +
        "  2. request the token per the manual on https://data.go.th/dataset/dataset_02_04\n" +
        "  3. run: RKJ_TOKEN=<token> npx tsx scripts/link-ratchakitcha.ts\n"
    );
    process.exit(1);
  }

  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
  const targets = await prisma.gazetteEntry.findMany({
    where: {
      origin: "krisdika",
      sourceUrl: null,
      volume: { gt: 0 },
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: Number.isFinite(limit) ? limit : undefined,
  });
  console.log(`querying official API for ${targets.length} entries with citations`);

  let linked = 0, noMatch = 0, apiErr = 0, done = 0;
  for (const e of targets) {
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${targets.length} (linked ${linked})`);
    const partExtra = e.category.includes("พิเศษ") ? "พิเศษ" : undefined;
    let records: ApiRecord[];
    try {
      records = await queryGazette({
        bookNo: e.volume,
        part: e.issue,
        partExtra,
        date: fmtDate(e.publishedAt!),
      });
    } catch {
      apiErr++;
      if (apiErr > 20) {
        console.error("too many API errors — stopping (check token/rate limit)");
        break;
      }
      continue;
    }
    const myTitle = compact(e.title);
    const match = records.filter((r) => {
      const rTitle = compact(String(r.subject ?? r.title ?? ""));
      const samePage = String(r.pageNo ?? "") === String(e.page);
      return (
        r.filePath &&
        (rTitle === myTitle || (samePage && (rTitle.includes(myTitle.slice(0, 40)) || myTitle.includes(rTitle.slice(0, 40)))))
      );
    });
    if (match.length !== 1) {
      noMatch++;
      continue;
    }
    await prisma.gazetteEntry.update({
      where: { id: e.id },
      data: { sourceUrl: match[0].filePath!.replace(/^http:/, "https:") },
    });
    linked++;
    await new Promise((r) => setTimeout(r, 400)); // be polite to the API
  }
  console.log(`done: linked ${linked}, no-unique-match ${noMatch}, api-errors ${apiErr}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
