/**
 * Seed regulator (หน่วยงานกำกับดูแล) websites as authoritative Sources on the
 * acts they administer. All URLs verified live on 2026-07-03.
 *
 * Matching is against Act.shortName: `exact` must equal the whole name,
 * `contains` must be a distinctive substring (>= 6 Thai chars) — deliberately
 * conservative; unmatched acts are simply skipped.
 *
 * Usage: npx tsx scripts/seed-regulators.ts [--dry-run]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Pattern {
  exact?: string;
  contains?: string;
}

interface Regulator {
  name: string; // full Thai name
  url: string;
  laws: Pattern[];
}

const REGULATORS: Regulator[] = [
  { name: "ธนาคารแห่งประเทศไทย (ธปท.)", url: "https://www.bot.or.th", laws: [
    { contains: "ธุรกิจสถาบันการเงิน" }, { contains: "ระบบการชำระเงิน" }, { exact: "เงินตรา" },
    { contains: "ธนาคารแห่งประเทศไทย" }, { contains: "ดอกเบี้ยเงินให้กู้ยืมของสถาบันการเงิน" } ] },
  { name: "สำนักงานคณะกรรมการกำกับหลักทรัพย์และตลาดหลักทรัพย์ (ก.ล.ต.)", url: "https://www.sec.or.th", laws: [
    { contains: "หลักทรัพย์และตลาดหลักทรัพย์" }, { contains: "การประกอบธุรกิจสินทรัพย์ดิจิทัล" },
    { contains: "สัญญาซื้อขายล่วงหน้า" }, { contains: "ทรัสต์เพื่อธุรกรรมในตลาดทุน" }, { contains: "กองทุนสำรองเลี้ยงชีพ" } ] },
  { name: "สำนักงาน คปภ.", url: "https://www.oic.or.th", laws: [
    { contains: "ประกันชีวิต" }, { contains: "ประกันวินาศภัย" },
    { contains: "คณะกรรมการกำกับและส่งเสริมการประกอบธุรกิจประกันภัย" },
    { contains: "คุ้มครองผู้ประสบภัยจากรถ" } ] },
  { name: "สำนักงาน ปปง.", url: "https://www.amlo.go.th", laws: [
    { contains: "ป้องกันและปราบปรามการฟอกเงิน" },
    { contains: "การสนับสนุนทางการเงินแก่การก่อการร้าย" } ] },
  { name: "กรมสรรพากร", url: "https://www.rd.go.th", laws: [
    { exact: "รัษฎากร" }, { contains: "ภาษีการรับมรดก" }, { contains: "ภาษีเงินได้ปิโตรเลียม" },
    { contains: "ภาษีส่วนเพิ่ม" }, { contains: "ความตกลงระหว่างประเทศเกี่ยวกับภาษีอากร" } ] },
  { name: "กรมสรรพสามิต", url: "https://www.excise.go.th", laws: [{ contains: "ภาษีสรรพสามิต" }] },
  { name: "กรมศุลกากร", url: "https://www.customs.go.th", laws: [{ exact: "ศุลกากร" }] },
  { name: "สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)", url: "https://www.pdpc.or.th", laws: [
    { contains: "คุ้มครองข้อมูลส่วนบุคคล" } ] },
  { name: "สำนักงานคณะกรรมการการรักษาความมั่นคงปลอดภัยไซเบอร์แห่งชาติ (สกมช.)", url: "https://www.ncsa.or.th", laws: [
    { contains: "การรักษาความมั่นคงปลอดภัยไซเบอร์" } ] },
  { name: "สำนักงานพัฒนาธุรกรรมทางอิเล็กทรอนิกส์ (ETDA)", url: "https://www.etda.or.th", laws: [
    { contains: "ธุรกรรมทางอิเล็กทรอนิกส์" }, { contains: "บริการแพลตฟอร์มดิจิทัล" } ] },
  { name: "สำนักงาน กสทช.", url: "https://www.nbtc.go.th", laws: [
    { contains: "องค์กรจัดสรรคลื่นความถี่" }, { contains: "การประกอบกิจการกระจายเสียง" },
    { contains: "การประกอบกิจการโทรคมนาคม" }, { contains: "วิทยุคมนาคม" } ] },
  { name: "กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม", url: "https://www.mdes.go.th", laws: [
    { contains: "การกระทำความผิดเกี่ยวกับคอมพิวเตอร์" } ] },
  { name: "กรมพัฒนาธุรกิจการค้า", url: "https://www.dbd.go.th", laws: [
    { exact: "การบัญชี" }, { contains: "ทะเบียนพาณิชย์" }, { contains: "หอการค้า" },
    { contains: "สมาคมการค้า" }, { contains: "บริษัทมหาชนจำกัด" },
    { contains: "ห้างหุ้นส่วนจดทะเบียน" }, { contains: "การประกอบธุรกิจของคนต่างด้าว" } ] },
  { name: "สำนักงานคณะกรรมการการแข่งขันทางการค้า", url: "https://www.tcct.or.th", laws: [
    { contains: "การแข่งขันทางการค้า" } ] },
  { name: "กรมทรัพย์สินทางปัญญา", url: "https://www.ipthailand.go.th", laws: [
    { exact: "สิทธิบัตร" }, { exact: "ลิขสิทธิ์" }, { contains: "เครื่องหมายการค้า" },
    { contains: "ความลับทางการค้า" }, { contains: "สิ่งบ่งชี้ทางภูมิศาสตร์" }, { contains: "แบบผังภูมิของวงจรรวม" } ] },
  { name: "สำนักงานคณะกรรมการคุ้มครองผู้บริโภค (สคบ.)", url: "https://www.ocpb.go.th", laws: [
    { contains: "คุ้มครองผู้บริโภค" }, { contains: "ขายตรงและตลาดแบบตรง" },
    { contains: "ความเสียหายที่เกิดขึ้นจากสินค้าที่ไม่ปลอดภัย" } ] },
  { name: "สำนักงานมาตรฐานผลิตภัณฑ์อุตสาหกรรม (สมอ.)", url: "https://www.tisi.go.th", laws: [
    { contains: "มาตรฐานผลิตภัณฑ์อุตสาหกรรม" }, { contains: "การมาตรฐานแห่งชาติ" } ] },
  { name: "กรมโรงงานอุตสาหกรรม", url: "https://www.diw.go.th", laws: [
    { exact: "โรงงาน" }, { exact: "วัตถุอันตราย" }, { contains: "จดทะเบียนเครื่องจักร" } ] },
  { name: "สำนักงานคณะกรรมการอาหารและยา (อย.)", url: "https://www.fda.moph.go.th", laws: [
    { exact: "ยา" }, { exact: "อาหาร" }, { contains: "เครื่องมือแพทย์" }, { contains: "เครื่องสำอาง" },
    { contains: "วัตถุที่ออกฤทธิ์ต่อจิตและประสาท" }, { contains: "ยาเสพติดให้โทษ" },
    { contains: "ผลิตภัณฑ์สมุนไพร" } ] },
  { name: "กรมสนับสนุนบริการสุขภาพ", url: "https://hss.moph.go.th", laws: [
    { exact: "สถานพยาบาล" }, { contains: "สถานประกอบการเพื่อสุขภาพ" } ] },
  { name: "กรมสวัสดิการและคุ้มครองแรงงาน", url: "https://www.labour.go.th", laws: [
    { contains: "คุ้มครองแรงงาน" }, { exact: "แรงงานสัมพันธ์" }, { contains: "แรงงานรัฐวิสาหกิจสัมพันธ์" },
    { contains: "ความปลอดภัย อาชีวอนามัย" } ] },
  { name: "สำนักงานประกันสังคม", url: "https://www.sso.go.th", laws: [
    { exact: "ประกันสังคม" }, { exact: "เงินทดแทน" } ] },
  { name: "กรมที่ดิน", url: "https://www.dol.go.th", laws: [
    { exact: "ที่ดิน" }, { contains: "การจัดสรรที่ดิน" }, { exact: "อาคารชุด" }, { contains: "ช่างรังวัดเอกชน" },
    { contains: "การเช่าอสังหาริมทรัพย์เพื่อพาณิชยกรรมและอุตสาหกรรม" } ] },
  { name: "กรมโยธาธิการและผังเมือง", url: "https://www.dpt.go.th", laws: [
    { contains: "ควบคุมอาคาร" }, { contains: "การผังเมือง" }, { contains: "การขุดดินและถมดิน" } ] },
  { name: "สำนักงานนโยบายและแผนทรัพยากรธรรมชาติและสิ่งแวดล้อม (สผ.)", url: "https://www.onep.go.th", laws: [
    { contains: "ส่งเสริมและรักษาคุณภาพสิ่งแวดล้อม" } ] },
  { name: "กรมการขนส่งทางบก", url: "https://www.dlt.go.th", laws: [
    { contains: "การขนส่งทางบก" }, { exact: "รถยนต์" }, { exact: "ล้อเลื่อน" } ] },
  { name: "สำนักงานการบินพลเรือนแห่งประเทศไทย (CAAT)", url: "https://www.caat.or.th", laws: [
    { contains: "การเดินอากาศ" } ] },
  { name: "กรมเจ้าท่า", url: "https://md.go.th", laws: [
    { contains: "การเดินเรือในน่านน้ำไทย" }, { exact: "เรือไทย" }, { contains: "ป้องกันเรือโดนกัน" } ] },
  { name: "สำนักงานคณะกรรมการกำกับกิจการพลังงาน (กกพ.)", url: "https://www.erc.or.th", laws: [
    { contains: "การประกอบกิจการพลังงาน" } ] },
  { name: "กรมธุรกิจพลังงาน", url: "https://www.doeb.go.th", laws: [
    { contains: "ควบคุมน้ำมันเชื้อเพลิง" }, { contains: "การค้าน้ำมันเชื้อเพลิง" } ] },
  { name: "กรมพัฒนาพลังงานทดแทนและอนุรักษ์พลังงาน (พพ.)", url: "https://www.dede.go.th", laws: [
    { contains: "การส่งเสริมการอนุรักษ์พลังงาน" } ] },
  { name: "สภาทนายความ", url: "https://www.lawyerscouncil.or.th", laws: [{ exact: "ทนายความ" }] },
  { name: "แพทยสภา", url: "https://www.tmc.or.th", laws: [{ contains: "วิชาชีพเวชกรรม" }] },
  { name: "สภาวิศวกร", url: "https://www.coe.or.th", laws: [{ exact: "วิศวกร" }] },
  { name: "สภาสถาปนิก", url: "https://www.act.or.th", laws: [{ exact: "สถาปนิก" }] },
  { name: "สำนักงาน ป.ป.ช.", url: "https://www.nacc.go.th", laws: [
    { contains: "ป้องกันและปราบปรามการทุจริต" } ] },
  { name: "สำนักงานคณะกรรมการการเลือกตั้ง (กกต.)", url: "https://www.ect.go.th", laws: [
    { contains: "ว่าด้วยการเลือกตั้งสมาชิกสภาผู้แทนราษฎร" }, { contains: "ว่าด้วยคณะกรรมการการเลือกตั้ง" },
    { contains: "ว่าด้วยพรรคการเมือง" }, { contains: "การเลือกตั้งสมาชิกสภาท้องถิ่น" } ] },
  { name: "สำนักงานมาตรฐานสินค้าเกษตรและอาหารแห่งชาติ (มกอช.)", url: "https://www.acfs.go.th", laws: [
    { contains: "มาตรฐานสินค้าเกษตร" } ] },
  { name: "กรมประมง", url: "https://www.fisheries.go.th", laws: [{ exact: "การประมง" }] },
  { name: "กรมปศุสัตว์", url: "https://www.dld.go.th", laws: [
    { contains: "ควบคุมการฆ่าสัตว์" }, { contains: "โรคระบาดสัตว์" },
    { contains: "ป้องกันการทารุณกรรม" }, { contains: "ควบคุมคุณภาพอาหารสัตว์" } ] },
  { name: "สำนักงานตรวจคนเข้าเมือง", url: "https://www.immigration.go.th", laws: [{ contains: "คนเข้าเมือง" }] },
  { name: "กรมการปกครอง", url: "https://www.dopa.go.th", laws: [
    { contains: "อาวุธปืน" }, { exact: "การพนัน" }, { exact: "โรงแรม" }, { exact: "สถานบริการ" },
    { contains: "การทะเบียนราษฎร" }, { contains: "บัตรประจำตัวประชาชน" } ] },
];

function compact(s: string): string {
  return s.replace(/ํา/g, "ำ").replace(/\s+/g, "");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const acts = await prisma.act.findMany({ select: { id: true, shortName: true, fullName: true } });

  let sources = 0, matchedActs = new Set<number>();
  for (const reg of REGULATORS) {
    const hits = new Map<number, string>();
    for (const p of reg.laws) {
      for (const a of acts) {
        const name = compact(a.shortName);
        if (p.exact && name === compact(p.exact)) {
          hits.set(a.id, a.fullName);
        } else if (p.contains) {
          const pat = compact(p.contains);
          // length guard: registry contains junk rows from bad title parses
          // whose overlong names may embed the pattern — don't match those
          if (name.includes(pat) && name.length <= pat.length + 40) {
            hits.set(a.id, a.fullName);
          }
        }
      }
    }
    console.log(`\n${reg.name} — ${hits.size} acts`);
    for (const [actId, fullName] of hits) {
      console.log(`   ${fullName.slice(0, 75)}`);
      matchedActs.add(actId);
      if (dryRun) continue;
      await prisma.source.upsert({
        where: { actId_url: { actId, url: reg.url } },
        create: {
          actId,
          url: reg.url,
          title: `หน่วยงานกำกับดูแล: ${reg.name}`,
          publisher: reg.name,
          contributor: "ระบบนำเข้าอัตโนมัติ (ตรวจสอบ URL แล้ว)",
        },
        update: {},
      });
      sources++;
    }
  }
  console.log(`\n=== ${dryRun ? "DRY RUN: would create" : "created/kept"} sources for ${matchedActs.size} acts (${sources} rows) ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
