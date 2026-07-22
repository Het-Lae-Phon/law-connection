/**
 * Backfill acts that are completely absent from the registry — not a linking
 * gap, but the founding act itself was never ingested (too old for the
 * gazette API feed which starts June 2566, and absent from the Krisdika
 * thailaw corpus). Found by: cross-referencing frequent "คณะกรรมการ<X>"
 * names in unlinked ง/ง พิเศษ sub-regulations against the Act registry.
 *
 * Each entry here was independently verified (OCR of an official PDF, or a
 * gazette citation cross-checked against 2+ independent sources) before
 * being added — see the `verifiedBy` note on each.
 *
 * Usage: npx tsx scripts/add-missing-acts.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MissingAct {
  actType: string;
  shortName: string;
  year: number;
  fullName: string;
  // primary gazette citation
  volume: number;
  issue: string;
  category: string;
  page: number;
  publishedAt: string; // ISO date
  // a working, verified http(s) URL for the primary document — or null if
  // none could be verified (the act row is still created; entries just
  // link to it and cite it, without a broken "ต้นฉบับ" button)
  pdfUrl: string | null;
  verifiedBy: string;
  // sub-regulation titles to re-link (must currently be unlinked)
  linkPattern: string; // substring match against unlinked entry titles
  // guard against false links: skip titles containing any of these
  // (e.g. "แพทยสภา" must NOT catch "ทันตแพทยสภา" / "สัตวแพทยสภา")
  excludePatterns?: string[];
  // authoritative regulator site to seed as a Source
  regulatorName: string;
  regulatorUrl: string;
}

const MISSING_ACTS: MissingAct[] = [
  {
    actType: "พระราชบัญญัติ",
    shortName: "การแข่งขันทางการค้า",
    year: 2560,
    fullName: "พระราชบัญญัติการแข่งขันทางการค้า พ.ศ. 2560",
    volume: 134,
    issue: "70",
    category: "ก",
    page: 22,
    publishedAt: "2017-07-07",
    pdfUrl: "https://www.tcct.or.th/assets/portals/1/files/article_20190221100332.pdf",
    verifiedBy: "OCR of TCCT-hosted PDF (2026-07-04): เล่ม 134 ตอนที่ 70 ก หน้า 22, 7 กรกฎาคม 2560",
    linkPattern: "คณะกรรมการการแข่งขันทางการค้า",
    regulatorName: "สำนักงานคณะกรรมการการแข่งขันทางการค้า (TCCT)",
    regulatorUrl: "https://www.tcct.or.th",
  },
  {
    actType: "พระราชบัญญัติ",
    shortName: "การแพทย์ฉุกเฉิน",
    year: 2551,
    fullName: "พระราชบัญญัติการแพทย์ฉุกเฉิน พ.ศ. 2551",
    volume: 125,
    issue: "44",
    category: "ก",
    page: 1,
    publishedAt: "2008-03-06",
    pdfUrl: null, // ratchakitcha legacy DATA/PDF path is Cloudflare-blocked; no other verified direct link found
    verifiedBy: "Web search cross-check (2026-07-04), 2+ independent sources agree: เล่ม 125 ตอนที่ 44 ก, 6 มีนาคม 2551",
    linkPattern: "คณะกรรมการการแพทย์ฉุกเฉิน",
    regulatorName: "สถาบันการแพทย์ฉุกเฉินแห่งชาติ (สพฉ.)",
    regulatorUrl: "https://www.niems.go.th",
  },
  {
    actType: "พระราชบัญญัติ",
    shortName: "สถาปนิก",
    year: 2543,
    fullName: "พระราชบัญญัติสถาปนิก พ.ศ. 2543",
    volume: 117,
    issue: "10",
    category: "ก",
    page: 0, // gazette footnote omits the page; เล่ม/ตอน/วันที่ verified
    publishedAt: "2000-02-20",
    pdfUrl: "https://download.asa.or.th/03media/04law/aa/aa43-upd66.pdf",
    verifiedBy:
      "OCR of ASA-hosted consolidated PDF (2026-07-08): ประกาศในราชกิจจานุเบกษา เล่ม 117 ตอนที่ 10 ก วันที่ 20 กุมภาพันธ์ 2543; ให้ไว้ ณ วันที่ 7 กุมภาพันธ์ 2543",
    linkPattern: "สภาสถาปนิก",
    regulatorName: "สภาสถาปนิก",
    regulatorUrl: "https://www.act.or.th",
  },
  {
    actType: "พระราชบัญญัติ",
    shortName: "วิชาชีพเวชกรรม",
    year: 2525,
    fullName: "พระราชบัญญัติวิชาชีพเวชกรรม พ.ศ. 2525",
    volume: 99,
    issue: "111 (ฉบับพิเศษ)",
    category: "ก",
    page: 1,
    publishedAt: "1982-08-11",
    pdfUrl: "https://www.tmc.or.th/download/law-medical_2525.pdf",
    verifiedBy:
      "OCR of Krisdika-sourced PDF (2026-07-08): ราชกิจจานุเบกษา เล่ม 99 ตอนที่ 111 ฉบับพิเศษ หน้า 1, 11 สิงหาคม 2525",
    linkPattern: "แพทยสภา",
    // must not catch the Dental / Veterinary councils
    excludePatterns: ["ทันตแพทยสภา", "สัตวแพทยสภา"],
    regulatorName: "แพทยสภา",
    regulatorUrl: "https://www.tmc.or.th",
  },
];

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

async function main() {
  for (const m of MISSING_ACTS) {
    console.log(`\n=== ${m.fullName} ===`);

    let act = await prisma.act.findFirst({ where: { shortName: m.shortName, actType: m.actType } });
    if (act) {
      console.log("  act already exists (id " + act.id + ") — skipping creation");
    } else {
      act = await prisma.act.create({
        data: {
          slug: `${m.actType}-${m.shortName}-${m.year}`.replace(/\s+/g, "-"),
          actType: m.actType,
          shortName: m.shortName,
          year: m.year,
          fullName: m.fullName,
        },
      });
      console.log("  created act id", act.id);
    }

    // primary entry for the act itself, if not already present
    const dedupeUrl = m.pdfUrl ?? `manual:${act.slug}`;
    const existingPrimary = await prisma.gazetteEntry.findUnique({ where: { pdfUrl: dedupeUrl } });
    if (!existingPrimary) {
      await prisma.gazetteEntry.create({
        data: {
          title: m.fullName,
          publishedAt: new Date(m.publishedAt + "T00:00:00Z"),
          volume: m.volume,
          issue: m.issue,
          category: m.category,
          page: m.page,
          pdfUrl: dedupeUrl,
          origin: "community",
          instrumentType: m.actType,
          isPrimary: true,
          isAmendment: false,
          actId: act.id,
          linkSource: "community",
          verifyStatus: "verified", // human-verified citation, per verifiedBy note
        },
      });
      console.log("  created primary gazette entry", m.pdfUrl ? "(with verified link)" : "(citation only, no verified link)");
    } else {
      console.log("  primary entry already present — skipping");
    }

    // link existing orphaned sub-regulations
    const orphans = await prisma.gazetteEntry.findMany({
      where: {
        actId: null,
        title: { contains: m.linkPattern },
        ...(m.excludePatterns?.length
          ? { NOT: m.excludePatterns.map((p) => ({ title: { contains: p } })) }
          : {}),
      },
    });
    let linked = 0;
    for (const e of orphans) {
      await prisma.gazetteEntry.update({
        where: { id: e.id },
        data: { actId: act.id, linkSource: "title" },
      });
      linked++;
    }
    console.log(`  linked ${linked} previously-orphaned sub-regulations`);

    // seed regulator source
    await prisma.source.upsert({
      where: { actId_url: { actId: act.id, url: m.regulatorUrl } },
      create: {
        actId: act.id,
        url: m.regulatorUrl,
        title: `หน่วยงานกำกับดูแล: ${m.regulatorName}`,
        publisher: m.regulatorName,
        contributor: `ระบบนำเข้าอัตโนมัติ (${m.verifiedBy})`,
      },
      update: {},
    });
    console.log("  seeded regulator source:", m.regulatorName);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
