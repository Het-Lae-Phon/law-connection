export const GROUP_ORDER = [
  "พระราชบัญญัติ",
  "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "พระราชกำหนด",
  "พระราชกฤษฎีกา",
  "กฎกระทรวง",
  "กฎ",
  "ประกาศ",
  "ระเบียบ",
  "ข้อบังคับ",
  "ข้อกำหนด",
  "คำสั่ง",
];

export const GROUP_LABELS: Record<string, string> = {
  "พระราชบัญญัติ": "พระราชบัญญัติ / ฉบับแก้ไขเพิ่มเติม",
  "พระราชบัญญัติประกอบรัฐธรรมนูญ": "พระราชบัญญัติประกอบรัฐธรรมนูญ",
  "พระราชกำหนด": "พระราชกำหนด",
  "พระราชกฤษฎีกา": "พระราชกฤษฎีกา",
  "กฎกระทรวง": "กฎกระทรวง",
  "กฎ": "กฎ (ก.พ. / ก.ตร. / อื่น ๆ)",
  "ประกาศ": "ประกาศ",
  "ระเบียบ": "ระเบียบ",
  "ข้อบังคับ": "ข้อบังคับ",
  "ข้อกำหนด": "ข้อกำหนด",
  "คำสั่ง": "คำสั่ง",
};

// Short label for the breadcrumb crumb — distinguishes primary-legislation
// amendments (peers of the parent act) from genuinely subordinate instruments.
export function instrumentBreadcrumbLabel(instrumentType: string | null): string {
  if (!instrumentType) return "กฎหมายลำดับรอง";
  return GROUP_LABELS[instrumentType] ?? instrumentType;
}
