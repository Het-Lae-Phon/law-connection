/**
 * Typeset a Krisdika plain-text law document into blocks that mirror the
 * layout of the printed Royal Gazette:
 *   - centered title block (พระราชบัญญัติ / ชื่อ / พ.ศ. ...)
 *   - centered promulgation block (พระปรมาภิไธย, ให้ไว้ ณ วันที่..., เป็นปีที่...)
 *   - centered section headings (หมวด/ภาค/ลักษณะ/ส่วนที่/บทเฉพาะกาล)
 *   - justified body paragraphs with a first-line indent
 *   - centered signature block (ประกาศ/สั่ง ณ วันที่..., ผู้รับสนองฯ, names)
 *   - muted editorial footnotes (Krisdika staff notes, gazette citation)
 */

export type BlockKind = "title" | "meta" | "heading" | "para" | "sign" | "note";

export interface Block {
  kind: BlockKind;
  lines: string[]; // for para, join with a space; others keep line structure
}

const META_RE = /(ให้ไว้\s*ณ\s*วันที่|เป็นปีที่\s*[๐-๙0-9]+\s*ในรัชกาล)/;
// first paragraph of the operative text — ends the centered head area
const BODY_START_RE =
  /^(สมเด็จพระ|พระบาทสมเด็จ|อาศัยอำนาจ|โดยที่|ด้วยเหตุ|ด้วย\s|ตามที่|ตามความใน|เพื่อให้เป็นไปตาม|อนุสนธิ)/;
const HEADING_RE =
  /^(หมวด\s*[๐-๙0-9]+|ภาค\s*[๐-๙0-9]+|ลักษณะ\s*[๐-๙0-9]+|ส่วนที่\s*[๐-๙0-9]+|บทเฉพาะกาล$|บทนิยาม$|อัตราค่าธรรมเนียม$|บัญชี(ท้าย|อัตรา))/;
const SIGN_START_RE =
  /^(ผู้รับสนองพระ(บรม)?ราชโองการ|ประกาศ\s*ณ\s*วันที่|สั่ง\s*ณ\s*วันที่|ให้ไว้\s*ณ\s*วันที่)/;
const NAME_RE =
  /^\(?(พล(เอก|โท|ตรี|ตำรวจ)|นาย|นาง|นางสาว|หม่อม|ศาสตราจารย์|ร้อย|พัน|เรือ|จอมพล|คุณหญิง|ท่านผู้หญิง)/;
const ROLE_RE =
  /^(นายกรัฐมนตรี|รองนายกรัฐมนตรี|รัฐมนตรี(ว่าการ|ช่วยว่าการ)?|ปลัดกระทรวง|อธิบดี|เลขาธิการ|ผู้ว่าราชการ|ประธาน(กรรมการ|ศาล|สภา)|ผู้บัญชาการ|ผู้อำนวยการ|ในพระปรมาภิไธย|แทน)/;
const NOTE_START_RE =
  /(\/(จัดทำ|ตรวจ|ปรับปรุง|เพิ่มเติม)$|^\[[๐-๙0-9]+\]|^ราชกิจจานุเบกษา\s*เล่ม)/;

function isShortLines(lines: string[], max = 60): boolean {
  return lines.every((l) => l.trim().length <= max);
}

// Lines that always start a new logical block even without a blank line
// before them (the source text often runs the document tail together).
const FORCE_SPLIT_RE =
  /^(หมายเหตุ|ผู้รับสนองพระ(บรม)?ราชโองการ|ประกาศ\s*ณ\s*วันที่|สั่ง\s*ณ\s*วันที่|หมวด\s*[๐-๙0-9]|ภาค\s*[๐-๙0-9]|ลักษณะ\s*[๐-๙0-9]|บทเฉพาะกาล$)/;

export function typesetLegalText(text: string): Block[] {
  // group into blank-line-separated chunks, also splitting at semantic markers
  const groups: string[][] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };
  for (const raw of text.replace(/\\_/g, "_").split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    // pure-underscore rules are layout artifacts; treat as separators
    if (!line || /^_{3,}$/.test(line)) {
      flush();
      continue;
    }
    if (FORCE_SPLIT_RE.test(line) || NOTE_START_RE.test(line)) flush();
    cur.push(line);
  }
  flush();

  const blocks: Block[] = [];
  let inNotes = false;
  let sawBody = false;

  groups.forEach((g, i) => {
    if (inNotes) {
      blocks.push({ kind: "note", lines: g });
      return;
    }
    if (NOTE_START_RE.test(g[0])) {
      inNotes = true;
      blocks.push({ kind: "note", lines: g });
      return;
    }
    if (i === 0) {
      blocks.push({ kind: "title", lines: g });
      return;
    }
    // centered head area: ที่ .../เรื่อง .../(ฉบับที่ n)/พระปรมาภิไธย/ให้ไว้ ณ วันที่...
    // — everything between the title and the first operative paragraph
    if (
      !sawBody &&
      i <= 8 &&
      isShortLines(g, 70) &&
      (g.some((l) => META_RE.test(l)) || !BODY_START_RE.test(g[0]))
    ) {
      blocks.push({ kind: "meta", lines: g });
      return;
    }
    if (g.length <= 2 && isShortLines(g, 45) && HEADING_RE.test(g[0])) {
      blocks.push({ kind: "heading", lines: g });
      return;
    }
    if (
      isShortLines(g, 60) &&
      (SIGN_START_RE.test(g[0]) || NAME_RE.test(g[0]) || ROLE_RE.test(g[0]))
    ) {
      blocks.push({ kind: "sign", lines: g });
      return;
    }
    sawBody = true;
    blocks.push({ kind: "para", lines: g });
  });

  return blocks;
}
