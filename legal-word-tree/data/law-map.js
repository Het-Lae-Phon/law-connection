// Legal Word Tree — curated mapping layer (edit by hand)
//
// Maps TDPG4.0 chapters and sub-regulations onto the มาตรา of the PDPA that
// they interpret or are issued under. Keys are node ids from the generated
// act structure: "s37" = มาตรา 37, "chapter-5" = หมวด 5.
//
// TDPG4.0: Thailand Data Protection Guidelines 4.0, Faculty of Law,
// Chulalongkorn University — https://www.oa.law.chula.ac.th/tdpg-4-0/ (CC BY 3.0 TH)

window.LAW_MAP = {
  tdpgChapters: {
    A: { name: "ขอบเขตและการจำแนกประเภทข้อมูลส่วนบุคคล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/a/" },
    B: { name: "บทบาทหน้าที่ของผู้ควบคุมและผู้ประมวลผลข้อมูล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/b/" },
    C: { name: "ฐานในการประมวลผลข้อมูลส่วนบุคคล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/c/" },
    D: { name: "การจัดทำบันทึกรายการประมวลผลข้อมูล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/d/" },
    E: { name: "การแจ้งวัตถุประสงค์และรายละเอียดในการประมวลผล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/e/" },
    F: { name: "การโอนข้อมูลไปยังต่างประเทศ", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/f/" },
    G: { name: "การเก็บรักษาข้อมูลส่วนบุคคล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/g/" },
    H: { name: "การจัดการคำร้องขอของเจ้าของข้อมูล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/h/" },
    I: { name: "การรักษาความมั่นคงปลอดภัย", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/i/" },
    J: { name: "การจัดการเหตุการละเมิดข้อมูล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/j/" },
    K: { name: "ข้อตกลงการประมวลผล (DPA) และการแบ่งปันข้อมูล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/k/" },
    L: { name: "การจัดทำข้อมูลนิรนาม", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/l/" },
    M: { name: "คำร้องขอเข้าถึงข้อมูลจากรัฐ", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/m/" },
    N: { name: "เรื่องร้องเรียนและการตรวจสอบการฝ่าฝืนกฎหมาย", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/n/" },
    P: { name: "การประเมินผลกระทบด้านการคุ้มครองข้อมูลส่วนบุคคล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/p/" },
    R: { name: "ตัวแทนของผู้ควบคุมข้อมูล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/r/" },
    S: { name: "ข้อมูลอ่อนไหว", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/s/" },
    DPO: { name: "เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล", url: "https://www.oa.law.chula.ac.th/tdpg-4-0/dpo/" },
  },

  // มาตรา → TDPG4.0 chapters that interpret it (e.g. security → ม.37 → I)
  sectionTdpg: {
    s4: ["A"],
    s5: ["A", "R"],
    s6: ["A", "L"],
    s19: ["C"],
    s20: ["C"],
    s21: ["C", "E"],
    s22: ["C"],
    s23: ["E"],
    s24: ["C"],
    s25: ["C", "M"],
    s26: ["S"],
    s27: ["C", "K", "M"],
    s28: ["F"],
    s29: ["F"],
    s30: ["H"],
    s31: ["H"],
    s32: ["H"],
    s33: ["H"],
    s34: ["H"],
    s35: ["H"],
    s36: ["H"],
    s37: ["B", "G", "I", "J", "P", "R"],
    s38: ["B"],
    s39: ["D"],
    s40: ["B", "D", "K"],
    s41: ["DPO"],
    s42: ["DPO"],
    s71: ["N"],
    s72: ["N"],
    s73: ["N"],
    s74: ["N"],
    s75: ["N"],
    s76: ["N"],
    s90: ["N"],
  },

  // มาตรา → sub-regulations issued under / implementing it
  sectionSubregs: {
    s4: ["decree-2563", "decree-2566", "security-exempt"],
    s24: ["research"],
    s26: ["research"],
    s28: ["s28-notif"],
    s29: ["s29-notif"],
    s37: ["security-2565", "breach"],
    s39: ["records-processor", "records-smallbiz"],
    s41: ["dpo-412", "dpo-gov"],
    s71: ["expert-quals"],
    s74: ["expert-orders"],
    s76: ["officer-appointments", "officer-quals", "officer-idcard"],
    s90: ["fines-2565", "fines-2568"],
  },

  subregs: {
    "decree-2563": {
      name: "พ.ร.ฎ. ยกเว้นหน่วยงานและกิจการ พ.ศ. 2563",
      id: "decree-2563",
      type: "decree",
      detail:
        "พระราชกฤษฎีกากำหนดหน่วยงานและกิจการที่ผู้ควบคุมข้อมูลส่วนบุคคลไม่อยู่ภายใต้บังคับแห่ง พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 พ.ศ. 2563 " +
        "(เลื่อนการบังคับใช้หมวดสำคัญออกไประหว่างช่วงเปลี่ยนผ่าน) · ราชกิจจานุเบกษา เล่ม 137 ตอนที่ 37 ก · 21 พ.ค. 2563",
      links: [{ label: "ดูในระบบ (thailaw:34005)", url: "http://localhost:3000/doc/34005" }],
    },
    "decree-2566": {
      name: "พ.ร.ฎ. ยกเว้นบางส่วน พ.ศ. 2566",
      id: "decree-2566",
      type: "decree",
      detail:
        "พระราชกฤษฎีกากำหนดลักษณะ กิจการ หรือหน่วยงานที่ได้รับการยกเว้นไม่ให้นำ พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 บางส่วนมาใช้บังคับ พ.ศ. 2566 " +
        "· ราชกิจจานุเบกษา เล่ม 140 ตอนที่ 48 ก หน้า 45 · 17 ส.ค. 2566",
      links: [{ label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/140A048N0000000004500.pdf" }],
    },
    "security-exempt": {
      name: "ประกาศฯ มาตรฐานความมั่นคงปลอดภัยของผู้ควบคุมที่ได้รับยกเว้น พ.ศ. 2566",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง มาตรฐานการรักษาความมั่นคงปลอดภัยของข้อมูลส่วนบุคคล " +
        "ของผู้ควบคุมข้อมูลส่วนบุคคลซึ่งได้รับการยกเว้นไม่ให้นำ พ.ร.บ. มาใช้บังคับ พ.ศ. 2566 " +
        "· ราชกิจจานุเบกษา เล่ม 140 ตอนพิเศษ 309 ง หน้า 74 · ธ.ค. 2566",
      links: [
        { label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/13995.pdf" },
        { label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2023/12/announce-pdpc2.pdf" },
      ],
    },
    research: {
      name: "ประกาศฯ มาตรการที่เหมาะสมเพื่อการวิจัย/สถิติ พ.ศ. 2566",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง มาตรการที่เหมาะสมสำหรับการเก็บรวบรวมข้อมูลส่วนบุคคล " +
        "เพื่อให้บรรลุวัตถุประสงค์เกี่ยวกับการศึกษาวิจัยหรือสถิติตามมาตรา 24(1) และมาตรา 26(5)(ง) " +
        "· ราชกิจจานุเบกษา เล่ม 141 ตอนพิเศษ 7 ง หน้า 21 · ม.ค. 2567",
      links: [{ label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/16521.pdf" }],
    },
    "s28-notif": {
      name: "ประกาศฯ การโอนข้อมูลตามมาตรา 28 พ.ศ. 2566",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์การให้ความคุ้มครองข้อมูลส่วนบุคคล " +
        "ที่ส่งหรือโอนไปยังต่างประเทศตามมาตรา 28 พ.ศ. 2566 · ราชกิจจานุเบกษา เล่ม 140 ตอนพิเศษ 323 ง หน้า 33 · ธ.ค. 2566",
      links: [
        { label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/14915.pdf" },
        { label: "คำแปลภาษาอังกฤษ (ไม่เป็นทางการ)", url: "https://www.pdpc.or.th/wp-content/uploads/2025/03/PDPC-Notification-S28-2023-.pdf" },
      ],
    },
    "s29-notif": {
      name: "ประกาศฯ การโอนข้อมูลตามมาตรา 29 พ.ศ. 2566",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์การให้ความคุ้มครองข้อมูลส่วนบุคคล " +
        "ที่ส่งหรือโอนไปยังต่างประเทศตามมาตรา 29 พ.ศ. 2566 (BCR / มาตรการคุ้มครองที่เหมาะสม) " +
        "· ราชกิจจานุเบกษา เล่ม 140 ตอนพิเศษ 323 ง หน้า 36 · ธ.ค. 2566",
      links: [
        { label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/14913.pdf" },
        { label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2025/02/Notification-of-the-Personal-Data-Protection-Committee-Section-29.pdf" },
      ],
    },
    "security-2565": {
      name: "ประกาศฯ มาตรการรักษาความมั่นคงปลอดภัย พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง มาตรการรักษาความมั่นคงปลอดภัยของผู้ควบคุมข้อมูลส่วนบุคคล พ.ศ. 2565 " +
        "— ออกตามมาตรา 37(1) กำหนดมาตรฐานขั้นต่ำด้าน administrative / technical / physical safeguards · มิ.ย. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2024/01/announcement-pdpc-05.pdf" }],
    },
    breach: {
      name: "ประกาศฯ การแจ้งเหตุการละเมิดข้อมูลส่วนบุคคล พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์และวิธีการในการแจ้งเหตุการละเมิดข้อมูลส่วนบุคคล พ.ศ. 2565 " +
        "— ออกตามมาตรา 37(4) · ธ.ค. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2023/12/announce-15122565.pdf" }],
    },
    "records-processor": {
      name: "ประกาศฯ บันทึกรายการของผู้ประมวลผล พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์และวิธีการในการจัดทำและเก็บรักษาบันทึกรายการ " +
        "ของกิจกรรมการประมวลผลข้อมูลส่วนบุคคลสำหรับผู้ประมวลผลข้อมูลส่วนบุคคล พ.ศ. 2565 · มิ.ย. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2024/01/announcement-pdpc-04.pdf" }],
    },
    "records-smallbiz": {
      name: "ประกาศฯ ยกเว้นบันทึกรายการสำหรับกิจการขนาดเล็ก พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง การยกเว้นการบันทึกรายการของผู้ควบคุมข้อมูลส่วนบุคคล " +
        "ซึ่งเป็นกิจการขนาดเล็ก พ.ศ. 2565 · มิ.ย. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2024/01/announcement-pdpc-03.pdf" }],
    },
    "dpo-412": {
      name: "ประกาศฯ การจัดให้มี DPO ตามมาตรา 41(2) พ.ศ. 2566",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง การจัดให้มีเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคลตามมาตรา 41(2) พ.ศ. 2566 " +
        "(เกณฑ์กิจกรรมหลักที่ต้องตรวจสอบข้อมูลอย่างสม่ำเสมอ / ข้อมูลจำนวนมาก) · ราชกิจจานุเบกษา เล่ม 140 ตอนพิเศษ 226 ง หน้า 12 · ก.ย. 2566",
      links: [{ label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/140D226S0000000001200.pdf" }],
    },
    "dpo-gov": {
      name: "ประกาศฯ หน่วยงานรัฐที่ต้องมี DPO (ฉบับที่ 2) พ.ศ. 2568",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง ผู้ควบคุมข้อมูลส่วนบุคคลและผู้ประมวลผลข้อมูลส่วนบุคคล " +
        "ที่เป็นหน่วยงานของรัฐซึ่งต้องจัดให้มีเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (ฉบับที่ 2) พ.ศ. 2568 · ต.ค. 2568",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2025/10/PDPC-0110256801.pdf" }],
    },
    "expert-quals": {
      name: "ประกาศฯ คุณสมบัติและการดำเนินงานของคณะกรรมการผู้เชี่ยวชาญ พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง คุณสมบัติและลักษณะต้องห้าม วาระการดำรงตำแหน่ง " +
        "การพ้นจากตำแหน่ง และการดำเนินงานอื่นของคณะกรรมการผู้เชี่ยวชาญ พ.ศ. 2565 — ออกตามมาตรา 71 วรรคสอง · มิ.ย. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2024/01/announcement-pdpc-02.pdf" }],
    },
    "expert-orders": {
      name: "ประกาศฯ การจัดทำคำสั่งของคณะกรรมการผู้เชี่ยวชาญ พ.ศ. 2566",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์และวิธีการในการจัดทำคำสั่งของคณะกรรมการผู้เชี่ยวชาญ พ.ศ. 2566 " +
        "· ราชกิจจานุเบกษา เล่ม 140 ตอนพิเศษ 146 ง หน้า 20 · มิ.ย. 2566",
      links: [
        { label: "PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/140D146S0000000002000.pdf" },
        { label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2023/12/announce-22062566.pdf" },
      ],
    },
    "officer-appointments": {
      name: "ประกาศ ดศ. แต่งตั้งพนักงานเจ้าหน้าที่ (ฉบับที่ 2–4)",
      type: "subreg",
      detail:
        "ประกาศกระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม เรื่อง แต่งตั้งพนักงานเจ้าหน้าที่ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 " +
        "ฉบับที่ 2 (ส.ค. 2566) · ฉบับที่ 3 (พ.ย. 2566) · ฉบับที่ 4 (ส.ค. 2567)",
      links: [
        { label: "ฉบับที่ 2 — PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/140D200S0000000002000.pdf" },
        { label: "ฉบับที่ 3 — PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/11375.pdf" },
        { label: "ฉบับที่ 4 — PDF ราชกิจจานุเบกษา", url: "https://ratchakitcha.soc.go.th/documents/37994.pdf" },
      ],
    },
    "officer-quals": {
      name: "ประกาศฯ คุณสมบัติพนักงานเจ้าหน้าที่ พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์เกี่ยวกับคุณสมบัติของพนักงานเจ้าหน้าที่ พ.ศ. 2565 · ส.ค. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2023/12/announce-13092565.pdf" }],
    },
    "officer-idcard": {
      name: "ประกาศฯ แบบบัตรประจำตัวพนักงานเจ้าหน้าที่ พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง กำหนดแบบบัตรประจำตัวของพนักงานเจ้าหน้าที่ พ.ศ. 2565 · ส.ค. 2565",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2024/01/announcement-pdpc-01.pdf" }],
    },
    "fines-2565": {
      name: "ประกาศฯ หลักเกณฑ์ลงโทษปรับทางปกครอง พ.ศ. 2565",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์การพิจารณาออกคำสั่งลงโทษปรับทางปกครอง " +
        "ของคณะกรรมการผู้เชี่ยวชาญ พ.ศ. 2565 · มิ.ย. 2565",
      links: [
        { label: "PDF ฉบับ พ.ศ. 2565", url: "https://www.pdpc.or.th/wp-content/uploads/2024/01/announcement-pdpc-06.pdf" },
        { label: "PDF ฉบับปรับปรุง ณ 8 พ.ค. 2567", url: "https://www.pdpc.or.th/wp-content/uploads/2024/06/Announcement-PDPC-Latest-01.pdf" },
      ],
    },
    "fines-2568": {
      name: "ประกาศฯ หลักเกณฑ์ลงโทษปรับทางปกครอง พ.ศ. 2568",
      type: "subreg",
      detail:
        "ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล เรื่อง หลักเกณฑ์การพิจารณาออกคำสั่งลงโทษปรับทางปกครอง " +
        "ของคณะกรรมการผู้เชี่ยวชาญ พ.ศ. 2568 (ฉบับล่าสุด) · เม.ย. 2568",
      links: [{ label: "PDF เว็บไซต์ สคส. (PDPC)", url: "https://www.pdpc.or.th/wp-content/uploads/2025/04/67805.pdf" }],
    },
  },
};
