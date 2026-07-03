// Legal Word Tree — PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)
// hierarchy: constitutional root → act → the act's own structure
// (หมวด/ส่วน → มาตรา → วรรค → อนุมาตรา), with TDPG4.0 chapters and
// sub-regulations mapped onto the มาตรา they interpret / are issued under
//
// this file holds only the hand-curated spine; at runtime index.html grafts:
//   - data/act-sections-data.js (generated) — chapters/มาตรา/วรรค + by-type listing
//   - data/law-map.js (curated) — TDPG4.0 ↔ มาตรา mapping + sub-regulation nodes
//
// sources:
//   - sub-regulation entries: law-connection dataset, Act id 299 (http://localhost:3000/act/299)
//   - TDPG4.0, Faculty of Law, Chulalongkorn University
//     https://www.oa.law.chula.ac.th/tdpg-4-0/ (CC BY 3.0 TH)
//   - constitutional basis: รัฐธรรมนูญแห่งราชอาณาจักรไทย พ.ศ. 2560 มาตรา 32
//
// node.type: root | constitution | act | chapter | provision | paragraph | item |
//            theme | subreg | decree | guideline | pending
// node.links: [{ label, url }]

window.WORD_TREE_DATA = {
  name: "สิทธิในความเป็นส่วนตัว",
  type: "root",
  detail:
    "Right to Privacy — รากฐานทางกฎหมายของการคุ้มครองข้อมูลส่วนบุคคลในประเทศไทย " +
    "รับรองไว้ในรัฐธรรมนูญ และแปลงเป็นกลไกคุ้มครองผ่าน พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
  children: [
    {
      name: "รัฐธรรมนูญ พ.ศ. 2560 มาตรา 32",
      type: "constitution",
      detail:
        "“บุคคลย่อมมีสิทธิในความเป็นส่วนตัว เกียรติยศ ชื่อเสียง และครอบครัว " +
        "การกระทำอันเป็นการละเมิดหรือกระทบต่อสิทธิของบุคคลตามวรรคหนึ่ง " +
        "หรือการนำข้อมูลส่วนบุคคลไปใช้ประโยชน์ไม่ว่าในทางใด ๆ จะกระทำมิได้ " +
        "เว้นแต่โดยอาศัยอำนาจตามบทบัญญัติแห่งกฎหมายที่ตราขึ้นเพียงเท่าที่จำเป็นเพื่อประโยชน์สาธารณะ” " +
        "— มาตรา 32 เป็นฐานทางรัฐธรรมนูญโดยตรงของกฎหมายคุ้มครองข้อมูลส่วนบุคคล",
      children: [
        {
          name: "พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
          id: "pdpa-act",
          type: "act",
          detail:
            "กฎหมายแม่บทว่าด้วยการคุ้มครองข้อมูลส่วนบุคคล ประกาศในราชกิจจานุเบกษา 27 พฤษภาคม 2562 " +
            "โครงสร้างกิ่งของต้นไม้นี้คือโครงสร้างของกฎหมายเอง (หมวด/ส่วน → มาตรา → วรรค) " +
            "โดยแนวปฏิบัติ TDPG4.0 และกฎหมายลำดับรองผูกไว้กับมาตราที่เกี่ยวข้อง",
          links: [
            { label: "หน้ากฎหมายแม่บทในระบบ (Act 299)", url: "http://localhost:3000/act/299" },
            { label: "TDPG4.0 — แนวปฏิบัติทั้งชุด", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/" },
            { label: "TDPG4.0 — คำนิยาม", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/definition/" },
          ],
          // generated chapters (หมวด → มาตรา → วรรค) are grafted in front of
          // these curated branches at runtime; by-type listing is appended last
          children: [
            {
              name: "แนวปฏิบัติเฉพาะด้าน (TDPG4.0)",
              type: "theme",
              detail:
                "แนวปฏิบัติรายฝ่ายงานและเทคโนโลยีจาก Thailand Data Protection Guidelines 4.0 " +
                "คณะนิติศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย (Open Access · CC BY 3.0 TH) — " +
                "หมวดเหล่านี้ตัดขวางหลายมาตรา จึงแสดงเป็นกิ่งแยกต่างหาก",
              links: [{ label: "TDPG4.0 — สารบัญและคำนิยาม", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/definition/" }],
              children: [
                { name: "AI — ปัญญาประดิษฐ์", type: "guideline", detail: "แนวปฏิบัติเกี่ยวกับการประมวลผลข้อมูลส่วนบุคคลด้วยปัญญาประดิษฐ์", links: [{ label: "TDPG4.0-AI", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/ai/" }] },
                { name: "ID — อัตลักษณ์ดิจิทัล / ลายมือชื่ออิเล็กทรอนิกส์", type: "guideline", detail: "แนวปฏิบัติสำหรับการใช้ข้อมูลอัตลักษณ์ดิจิทัลและลายมือชื่ออิเล็กทรอนิกส์", links: [{ label: "TDPG4.0-ID", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/id/" }] },
                { name: "IT — เทคโนโลยีสารสนเทศ", type: "guideline", detail: "แนวปฏิบัติสำหรับฝ่ายเทคโนโลยีสารสนเทศ", links: [{ label: "TDPG4.0-IT", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/it/" }] },
                { name: "HR — ทรัพยากรบุคคล", type: "guideline", detail: "แนวปฏิบัติเกี่ยวกับฝ่ายทรัพยากรบุคคล", links: [{ label: "TDPG4.0-HR", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/hr/" }] },
                { name: "MS — ขายและการตลาด", type: "guideline", detail: "แนวปฏิบัติสำหรับฝ่ายขายและการตลาด", links: [{ label: "TDPG4.0-MS", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/ms/" }] },
                { name: "DA — วิเคราะห์ข้อมูล", type: "guideline", detail: "แนวปฏิบัติเกี่ยวกับฝ่ายวิเคราะห์ข้อมูล", links: [{ label: "TDPG4.0-DA", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/da/" }] },
                { name: "PO — จัดซื้อจัดจ้าง", type: "guideline", detail: "แนวปฏิบัติเกี่ยวกับฝ่ายจัดซื้อจัดจ้าง", links: [{ label: "TDPG4.0-PO", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/po/" }] },
                { name: "MD — ผู้บริหารและกรรมการ", type: "guideline", detail: "แนวปฏิบัติสำหรับผู้บริหารระดับสูง กรรมการบริหาร และกรรมการบริษัท", links: [{ label: "TDPG4.0-MD", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/md/" }] },
              ],
            },
            {
              name: "รายการรอตรวจสอบ",
              type: "theme",
              detail: "รายการที่ระบบเชื่อมโยงอัตโนมัติแต่ยังไม่ได้รับการยืนยันโดยผู้เชี่ยวชาญ",
              children: [
                {
                  name: "ระเบียบ ก.ล.ต. ว่าด้วยการรับส่งข้อมูลอิเล็กทรอนิกส์ พ.ศ. 2564",
                  type: "pending",
                  detail:
                    "ระเบียบวิธีปฏิบัติสำนักงาน ก.ล.ต. ว่าด้วยการรับส่งข้อมูลอิเล็กทรอนิกส์ พ.ศ. 2564 — " +
                    "เชื่อมโยงอัตโนมัติจากเนื้อหา อาจออกตามกฎหมายฉบับอื่น (พ.ร.บ.หลักทรัพย์ฯ) โปรดตรวจสอบก่อนอ้างอิง",
                  links: [{ label: "ดูในระบบ (thailaw:10463)", url: "http://localhost:3000/doc/10463" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
