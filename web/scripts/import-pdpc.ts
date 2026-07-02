/**
 * Import sub-regulations of the PDPA from the regulator's website (สคส. / PDPC):
 * https://www.pdpc.or.th/category/pdpc-law/announce/announcement-pdpc/
 *
 * Walks the paginated WordPress listing, opens each announcement post to get
 * the publication date and the actual PDF attachment, dedupes against existing
 * entries by normalized title, and links everything to the PDPA act.
 * Also seeds the listing page itself as an authoritative Source on the act.
 *
 * Usage: npx tsx scripts/import-pdpc.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LIST_URL = "https://www.pdpc.or.th/category/pdpc-law/announce/announcement-pdpc/";
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };

// regulation-looking titles only (skip privacy notices, procurement posts, nav links)
const TITLE_PREFIXES = ["ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล", "ระเบียบคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล", "คำสั่ง"];

const THAI_MONTHS: Record<string, number> = {
  "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
  "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
};

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&#8211;|&ndash;/g, "-").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

interface Post {
  title: string;
  postUrl: string;
}

async function collectPosts(): Promise<Post[]> {
  const posts = new Map<string, Post>();
  for (let page = 1; page <= 10; page++) {
    const url = page === 1 ? LIST_URL : `${LIST_URL}page/${page}/`;
    let html: string;
    try {
      html = await fetchText(url);
    } catch {
      break; // past the last page
    }
    let found = 0;
    for (const m of html.matchAll(/<a[^>]+href="(https:\/\/www\.pdpc\.or\.th\/(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const title = stripTags(m[3]);
      if (!TITLE_PREFIXES.some((p) => title.startsWith(p))) continue;
      if (!posts.has(m[1])) {
        posts.set(m[1], { title, postUrl: m[1] });
        found++;
      }
    }
    console.log(`page ${page}: ${found} new posts`);
    if (found === 0 && page > 1) break;
  }
  return [...posts.values()];
}

// From a post page: full title (h1 can be truncated in listing), Thai date, first PDF link.
async function readPost(p: Post): Promise<{ title: string; date: Date | null; pdfUrl: string | null }> {
  const html = await fetchText(p.postUrl);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = h1 ? stripTags(h1[1]) : p.title;
  const dm = stripTags(html).match(/(\d{1,2})\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d{4})/);
  let date: Date | null = null;
  if (dm) {
    let year = parseInt(dm[3], 10);
    if (year > 2400) year -= 543;
    date = new Date(Date.UTC(year, THAI_MONTHS[dm[2]] - 1, parseInt(dm[1], 10)));
    if (isNaN(date.getTime())) date = null;
  }
  const pdf = html.match(/href="(https?:\/\/[^"]+\.pdf)"/i);
  return { title, date, pdfUrl: pdf ? pdf[1] : null };
}

async function main() {
  const act = await prisma.act.findFirst({
    where: { actType: "พระราชบัญญัติ", shortName: { contains: "คุ้มครองข้อมูลส่วนบุคคล" } },
  });
  if (!act) throw new Error("PDPA act not found in registry");
  console.log(`linking to: ${act.fullName} (id ${act.id})`);

  const posts = await collectPosts();
  console.log(`found ${posts.length} regulation posts on pdpc.or.th`);

  const existing = await prisma.gazetteEntry.findMany({ select: { title: true, pdfUrl: true } });
  const seenTitles = new Set(existing.map((e) => compact(e.title)));
  const seenUrls = new Set(existing.map((e) => e.pdfUrl));

  let imported = 0, duped = 0, failed = 0;
  for (const p of posts) {
    let detail;
    try {
      detail = await readPost(p);
    } catch {
      failed++;
      continue;
    }
    const title = detail.title || p.title;
    const key = compact(title);
    const url = detail.pdfUrl ?? p.postUrl;
    if (seenTitles.has(key) || seenUrls.has(url)) {
      duped++;
      continue;
    }
    seenTitles.add(key);
    seenUrls.add(url);
    const instrumentType = title.startsWith("ระเบียบ") ? "ระเบียบ" : title.startsWith("คำสั่ง") ? "คำสั่ง" : "ประกาศ";
    await prisma.gazetteEntry.create({
      data: {
        title,
        publishedAt: detail.date,
        volume: 0,
        issue: "",
        category: "",
        page: 0,
        pdfUrl: url,
        origin: "pdpc",
        instrumentType,
        isPrimary: false,
        isAmendment: /\(ฉบับที่\s*[0-9๐-๙]+\)/.test(title),
        actId: act.id,
        linkSource: "regulator",
      },
    });
    imported++;
    await new Promise((r) => setTimeout(r, 300));
  }

  // seed the regulator's announcements page as an authoritative source on the act
  await prisma.source.upsert({
    where: { actId_url: { actId: act.id, url: LIST_URL } },
    create: {
      actId: act.id,
      url: LIST_URL,
      title: "รวมประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (เว็บไซต์ สคส.)",
      publisher: "สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)",
      contributor: "ระบบนำเข้าอัตโนมัติ",
    },
    update: {},
  });

  console.log(`imported ${imported}, duplicates ${duped}, failed ${failed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
